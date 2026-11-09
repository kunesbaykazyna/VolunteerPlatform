--
-- PostgreSQL database dump
--

\restrict 2Cj2NvXu9BsAGiROUjfVjflk9qI78bPzaYSwCRlU3XI0yxUheyeMMOqpERXKUKm

-- Dumped from database version 17.6 (Postgres.app)
-- Dumped by pg_dump version 17.6 (Postgres.app)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: check_project_capacity(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.check_project_capacity() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    cap   INT;
    taken INT;
BEGIN
    IF NEW.status IN ('pending', 'confirmed') THEN
        -- Lock the project row so simultaneous sign-ups are checked one at a time
        SELECT max_capacity INTO cap
        FROM projects
        WHERE project_id = NEW.project_id
        FOR UPDATE;

        SELECT COUNT(*) INTO taken
        FROM registrations
        WHERE project_id = NEW.project_id
          AND status IN ('pending', 'confirmed')
          AND registration_id IS DISTINCT FROM NEW.registration_id;

        IF taken >= cap THEN
            RAISE EXCEPTION 'Project % is full (max capacity %)', NEW.project_id, cap;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.check_project_capacity() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: projects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.projects (
    project_id integer NOT NULL,
    organizer_id integer NOT NULL,
    title character varying(100) NOT NULL,
    description text,
    address character varying(150),
    city character varying(100),
    is_remote boolean DEFAULT false NOT NULL,
    start_datetime timestamp without time zone NOT NULL,
    end_datetime timestamp without time zone NOT NULL,
    max_capacity integer NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    deleted_at timestamp without time zone,
    category character varying(50) DEFAULT 'General'::character varying,
    CONSTRAINT chk_project_dates CHECK ((end_datetime > start_datetime)),
    CONSTRAINT projects_max_capacity_check CHECK ((max_capacity > 0)),
    CONSTRAINT projects_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'open'::character varying, 'full'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


ALTER TABLE public.projects OWNER TO postgres;

--
-- Name: projects_project_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.projects ALTER COLUMN project_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.projects_project_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: registrations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.registrations (
    registration_id integer NOT NULL,
    user_id integer NOT NULL,
    project_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    checked_in_at timestamp without time zone,
    hours_contributed numeric(5,2),
    CONSTRAINT registrations_hours_contributed_check CHECK ((hours_contributed >= (0)::numeric)),
    CONSTRAINT registrations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'waitlisted'::character varying, 'cancelled'::character varying, 'attended'::character varying, 'no_show'::character varying])::text[])))
);


ALTER TABLE public.registrations OWNER TO postgres;

--
-- Name: registrations_registration_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.registrations ALTER COLUMN registration_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.registrations_registration_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id integer NOT NULL,
    full_name character varying(100) NOT NULL,
    email character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) DEFAULT 'volunteer'::character varying NOT NULL,
    phone character varying(30),
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_login timestamp without time zone,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['volunteer'::character varying, 'organizer'::character varying, 'admin'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

ALTER TABLE public.users ALTER COLUMN user_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.projects (project_id, organizer_id, title, description, address, city, is_remote, start_datetime, end_datetime, max_capacity, status, created_at, deleted_at, category) FROM stdin;
1	1	Park Cleanup	Spring cleanup of the city park	Central Park	Almaty	f	2026-12-01 10:00:00	2026-12-01 14:00:00	2	open	2026-11-09 01:05:34.02328	\N	Environment
2	1	Food Drive	Collecting food for families	Community Hall	Almaty	f	2026-12-10 09:00:00	2026-12-10 13:00:00	10	open	2026-11-09 01:05:34.02328	\N	Social
\.


--
-- Data for Name: registrations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.registrations (registration_id, user_id, project_id, status, registered_at, checked_in_at, hours_contributed) FROM stdin;
1	2	1	confirmed	2026-11-09 01:05:34.02328	\N	\N
2	3	1	confirmed	2026-11-09 01:05:34.02328	\N	\N
3	2	2	pending	2026-11-09 01:05:34.02328	\N	\N
5	3	2	pending	2026-11-09 16:44:15.203307	\N	\N
11	5	2	pending	2026-11-09 16:59:23.959969	\N	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, full_name, email, password_hash, role, phone, is_active, created_at, last_login) FROM stdin;
1	Aigerim Nurova	aigerim@example.com	hash_1	organizer	+77010000001	t	2026-11-09 01:05:34.02328	\N
2	Daniyar Sadykov	daniyar@example.com	hash_2	volunteer	+77010000002	t	2026-11-09 01:05:34.02328	\N
3	Madina Kenzhebek	madina@example.com	hash_3	volunteer	+77010000003	t	2026-11-09 01:05:34.02328	\N
4	Timur Akhmetov	timur@example.com	hash_4	volunteer	\N	t	2026-11-09 01:05:34.02328	\N
5	Balenbai Balen	abracadabra@gmail.com	avtobus	volunteer	\N	t	2026-11-09 16:59:06.414545	\N
\.


--
-- Name: projects_project_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.projects_project_id_seq', 2, true);


--
-- Name: registrations_registration_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.registrations_registration_id_seq', 12, true);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 5, true);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (project_id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (registration_id);


--
-- Name: registrations uq_user_project; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT uq_user_project UNIQUE (user_id, project_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: idx_projects_city; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_city ON public.projects USING btree (city);


--
-- Name: idx_projects_organizer; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_organizer ON public.projects USING btree (organizer_id);


--
-- Name: idx_projects_start; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_projects_start ON public.projects USING btree (start_datetime);


--
-- Name: idx_reg_project; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_reg_project ON public.registrations USING btree (project_id);


--
-- Name: registrations trg_check_capacity; Type: TRIGGER; Schema: public; Owner: postgres
--

CREATE TRIGGER trg_check_capacity BEFORE INSERT OR UPDATE OF status, project_id ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.check_project_capacity();


--
-- Name: projects fk_projects_organizer; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fk_projects_organizer FOREIGN KEY (organizer_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: registrations fk_reg_project; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT fk_reg_project FOREIGN KEY (project_id) REFERENCES public.projects(project_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: registrations fk_reg_user; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT fk_reg_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 2Cj2NvXu9BsAGiROUjfVjflk9qI78bPzaYSwCRlU3XI0yxUheyeMMOqpERXKUKm

