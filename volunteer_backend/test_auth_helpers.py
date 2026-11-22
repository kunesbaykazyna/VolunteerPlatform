import unittest
from datetime import datetime, timedelta

from fastapi import HTTPException

from main import auth_token_is_usable, hash_auth_token, password_meets_requirements, require_verified_email


class AuthHelperTests(unittest.TestCase):
    def test_password_requires_eight_characters_letter_and_number(self):
        self.assertFalse(password_meets_requirements("abc123"))
        self.assertFalse(password_meets_requirements("abcdefgh"))
        self.assertFalse(password_meets_requirements("12345678"))
        self.assertTrue(password_meets_requirements("abcde123"))

    def test_auth_token_hash_is_fixed_length_and_not_plaintext(self):
        token = "one-time-random-token"
        token_hash = hash_auth_token(token)

        self.assertEqual(len(token_hash), 64)
        self.assertNotEqual(token_hash, token)
        self.assertEqual(token_hash, hash_auth_token(token))

    def test_auth_token_rejects_expired_and_used_tokens(self):
        now = datetime.now()
        usable = {"used_at": None, "expires_at": now + timedelta(minutes=1)}
        expired = {"used_at": None, "expires_at": now - timedelta(seconds=1)}
        used = {"used_at": now, "expires_at": now + timedelta(minutes=1)}

        self.assertTrue(auth_token_is_usable(usable, now))
        self.assertFalse(auth_token_is_usable(expired, now))
        self.assertFalse(auth_token_is_usable(used, now))
        self.assertFalse(auth_token_is_usable(None, now))

    def test_unverified_users_are_forbidden_from_project_actions(self):
        with self.assertRaises(HTTPException) as raised:
            require_verified_email({"email_verified": False})

        self.assertEqual(raised.exception.status_code, 403)
        require_verified_email({"email_verified": True})


if __name__ == "__main__":
    unittest.main()
