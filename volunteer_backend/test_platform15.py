import os
import unittest
from datetime import datetime, timedelta
from unittest.mock import patch

from fastapi import HTTPException

os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests")

import main


class FakeCursor:
    def __init__(self, fetchone_results=None, fetchall_results=None):
        self.fetchone_results = list(fetchone_results or [])
        self.fetchall_results = list(fetchall_results or [])
        self.executed = []
        self.closed = False

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self.fetchone_results.pop(0) if self.fetchone_results else None

    def fetchall(self):
        return self.fetchall_results.pop(0) if self.fetchall_results else []

    def close(self):
        self.closed = True


class FakeConnection:
    def __init__(self, cursor):
        self._cursor = cursor
        self.committed = False
        self.rolled_back = False
        self.closed = False

    def cursor(self):
        return self._cursor

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True

    def close(self):
        self.closed = True


class PlatformTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_pw_hash = main.hash_password("Test1234")

    def test_01_password_meets_requirements(self):
        self.assertFalse(main.password_meets_requirements("short1"))
        self.assertFalse(main.password_meets_requirements("onlyletters"))
        self.assertFalse(main.password_meets_requirements("12345678"))
        self.assertTrue(main.password_meets_requirements("Test1234"))

    def test_02_hash_auth_token_is_sha256(self):
        raw = "one-time-token-value"
        hashed = main.hash_auth_token(raw)
        self.assertEqual(len(hashed), 64)
        self.assertNotEqual(hashed, raw)
        self.assertEqual(hashed, main.hash_auth_token(raw))

    def test_03_auth_token_is_usable_checks_used_and_expiry(self):
        now = datetime.utcnow()
        valid = {"used_at": None, "expires_at": now + timedelta(minutes=10)}
        expired = {"used_at": None, "expires_at": now - timedelta(seconds=1)}
        used = {"used_at": now, "expires_at": now + timedelta(minutes=10)}

        self.assertTrue(main.auth_token_is_usable(valid, now))
        self.assertFalse(main.auth_token_is_usable(expired, now))
        self.assertFalse(main.auth_token_is_usable(used, now))
        self.assertFalse(main.auth_token_is_usable(None, now))

    def test_04_unverified_user_cannot_perform_verified_actions(self):
        with self.assertRaises(HTTPException) as ctx:
            main.require_verified_email({"email_verified": False})
        self.assertEqual(ctx.exception.status_code, 403)
        main.require_verified_email({"email_verified": True})

    def test_05_register_second_organizer_rejects_invalid_invite_code(self):
        cur = FakeCursor(fetchone_results=[None])
        conn = FakeConnection(cur)
        req = main.RegisterRequest(
            full_name="Second Org",
            email="sec@example.com",
            password_hash="Test1234",
            role="organizer",
            org_mode="join",
            invite_code="BADCODE",
        )
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.register_user(req)
        self.assertEqual(ctx.exception.status_code, 400)
        self.assertEqual(ctx.exception.detail, "invalid_invite_code")
        self.assertTrue(conn.rolled_back)

    def test_06_register_first_organizer_creates_company_and_super_role(self):
        cur = FakeCursor(
            fetchone_results=[
                {"user_id": 1, "full_name": "Boss", "email": "boss@example.com", "role": "organizer"},
                {"organization_id": 10},
            ]
        )
        conn = FakeConnection(cur)
        req = main.RegisterRequest(
            full_name="Boss",
            email="boss@example.com",
            password_hash="Test1234",
            role="organizer",
            org_mode="create",
            company_name="Green Almaty",
        )
        with patch("main.get_db_connection", return_value=conn), patch("main.send_auth_email") as mail:
            res = main.register_user(req)
        self.assertTrue(conn.committed)
        self.assertFalse(res["email_verified"])
        mail.assert_called_once()
        sql_joined = "\n".join(q for q, _ in cur.executed)
        self.assertIn("'super_organizer', 'active'", sql_joined)

    def test_07_register_second_organizer_with_valid_code_joins_as_pending(self):
        cur = FakeCursor(
            fetchone_results=[
                {"organization_id": 10},
                {"user_id": 2, "full_name": "Colleague", "email": "col@example.com", "role": "organizer"},
            ]
        )
        conn = FakeConnection(cur)
        req = main.RegisterRequest(
            full_name="Colleague",
            email="col@example.com",
            password_hash="Test1234",
            role="organizer",
            org_mode="join",
            invite_code="green001",
        )
        with patch("main.get_db_connection", return_value=conn), patch("main.send_auth_email"):
            main.register_user(req)
        self.assertTrue(conn.committed)
        sql_joined = "\n".join(q for q, _ in cur.executed)
        self.assertIn("'organizer', 'pending'", sql_joined)

    def test_08_pending_organizer_cannot_create_project(self):
        cur = FakeCursor(
            fetchone_results=[
                {"role": "organizer", "email_verified": True},
                {"organization_id": 10, "org_role": "organizer", "org_status": "pending", "company_name": "Green"},
            ]
        )
        conn = FakeConnection(cur)
        req = main.ProjectCreateRequest(
            title="New Cleanup",
            start_datetime="2026-12-01T10:00",
            end_datetime="2026-12-01T14:00",
            max_capacity=10,
        )
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.create_project(req, user_id=2)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_09_regular_organizer_cannot_delete_super_organizer_project(self):
        cur = FakeCursor(
            fetchone_results=[
                {
                    "project_id": 5,
                    "organizer_id": 1,
                    "organization_id": 10,
                    "status": "open",
                    "deleted_at": None,
                    "version": 1,
                    "org_role": "organizer",
                    "member_status": "active",
                }
            ]
        )
        conn = FakeConnection(cur)
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.delete_project(project_id=5, current_user_id=2)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_10_super_organizer_can_delete_colleague_project(self):
        cur = FakeCursor(
            fetchone_results=[
                {
                    "project_id": 6,
                    "organizer_id": 2,
                    "organization_id": 10,
                    "status": "open",
                    "deleted_at": None,
                    "version": 1,
                    "org_role": "super_organizer",
                    "member_status": "active",
                }
            ]
        )
        conn = FakeConnection(cur)
        with patch("main.get_db_connection", return_value=conn):
            res = main.delete_project(project_id=6, current_user_id=1)
        self.assertEqual(res["message"], "Project deleted")
        self.assertTrue(conn.committed)

    def test_11_concurrent_project_edit_returns_409_conflict(self):
        cur = FakeCursor(
            fetchone_results=[
                {
                    "project_id": 5,
                    "organizer_id": 1,
                    "organization_id": 10,
                    "status": "open",
                    "deleted_at": None,
                    "version": 2,
                    "org_role": "super_organizer",
                    "member_status": "active",
                }
            ]
        )
        conn = FakeConnection(cur)
        req = main.ProjectCreateRequest(
            title="Updated title",
            start_datetime="2026-12-01T10:00",
            end_datetime="2026-12-01T14:00",
            max_capacity=10,
            version=1,
        )
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.update_project(project_id=5, request=req, current_user_id=1)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_12_concurrent_application_review_returns_409_conflict(self):
        cur = FakeCursor(
            fetchone_results=[
                {
                    "registration_id": 12,
                    "current_status": "confirmed",
                    "project_id": 5,
                    "organizer_id": 1,
                    "organization_id": 10,
                    "project_status": "open",
                    "max_capacity": 8,
                    "member_status": "active",
                }
            ]
        )
        conn = FakeConnection(cur)
        req = main.StatusUpdateRequest(
            status="cancelled",
            rejection_reason="Too late to join",
            expected_status="pending",
        )
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.update_application_status(registration_id=12, request=req, current_user_id=2)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_13_regular_organizer_cannot_edit_company_profile(self):
        cur = FakeCursor(
            fetchone_results=[
                {"role": "organizer"},
                {"organization_id": 10, "org_role": "organizer", "org_status": "active"},
            ]
        )
        conn = FakeConnection(cur)
        req = main.ProfileUpdateRequest(company_name="Hijacked Company")
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.update_user_profile(user_id=2, request=req, current_user_id=2)
        self.assertEqual(ctx.exception.status_code, 403)

    def test_14_super_organizer_transfer_switches_roles_atomically(self):
        cur = FakeCursor(
            fetchone_results=[
                {"organization_id": 10, "org_role": "super_organizer", "org_status": "active"},
                {"member_id": 22, "status": "active"},
            ]
        )
        conn = FakeConnection(cur)
        body = main.OrganizationMemberAction(action="make_super")
        with patch("main.get_db_connection", return_value=conn):
            res = main.manage_org_member(target_user_id=2, body=body, current_user_id=1)
        self.assertEqual(res["message"], "Member updated")
        self.assertTrue(conn.committed)
        updates = [q for q, _ in cur.executed if q.strip().startswith("UPDATE organization_members")]
        self.assertEqual(len(updates), 2)
        self.assertIn("org_role = 'organizer'", updates[0])
        self.assertIn("org_role = 'super_organizer'", updates[1])

    def test_15_super_organizer_cannot_delete_account_while_colleagues_exist(self):
        cur = FakeCursor(
            fetchone_results=[
                {"password_hash": self.test_pw_hash, "role": "organizer"},
                {"organization_id": 10, "org_role": "super_organizer", "org_status": "active"},
            ],
            fetchall_results=[[{"user_id": 2}]],
        )
        conn = FakeConnection(cur)
        with patch("main.get_db_connection", return_value=conn):
            with self.assertRaises(HTTPException) as ctx:
                main.delete_account(main.DeleteAccountRequest(password="Test1234"), current_user_id=1)
        self.assertEqual(ctx.exception.status_code, 400)


if __name__ == "__main__":
    unittest.main()