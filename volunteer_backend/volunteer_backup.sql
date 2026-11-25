--
-- PostgreSQL database dump
--

\restrict O7tGm99E3qlUWE55riofUHuLAsZfPBnWCzg6w0amEYJ2xJLBqxF5d0UC0dvLypB

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

ALTER TABLE IF EXISTS ONLY public.volunteer_profiles DROP CONSTRAINT IF EXISTS volunteer_profiles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_organization_id_fkey;
ALTER TABLE IF EXISTS ONLY public.organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_organization_id_fkey;
ALTER TABLE IF EXISTS ONLY public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
ALTER TABLE IF EXISTS ONLY public.organization_members DROP CONSTRAINT IF EXISTS organization_members_organization_id_fkey;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS fk_reg_user;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS fk_reg_project;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS fk_projects_organizer;
ALTER TABLE IF EXISTS ONLY public.auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_user_id_fkey;
DROP TRIGGER IF EXISTS trg_check_capacity ON public.registrations;
DROP INDEX IF EXISTS public.uq_one_super_organizer_per_org;
DROP INDEX IF EXISTS public.idx_reg_project;
DROP INDEX IF EXISTS public.idx_projects_start;
DROP INDEX IF EXISTS public.idx_projects_organizer;
DROP INDEX IF EXISTS public.idx_projects_city;
ALTER TABLE IF EXISTS ONLY public.volunteer_profiles DROP CONSTRAINT IF EXISTS volunteer_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE IF EXISTS ONLY public.users DROP CONSTRAINT IF EXISTS users_email_key;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS uq_user_project;
ALTER TABLE IF EXISTS ONLY public.registrations DROP CONSTRAINT IF EXISTS registrations_pkey;
ALTER TABLE IF EXISTS ONLY public.projects DROP CONSTRAINT IF EXISTS projects_pkey;
ALTER TABLE IF EXISTS ONLY public.organizations DROP CONSTRAINT IF EXISTS organizations_pkey;
ALTER TABLE IF EXISTS ONLY public.organizations DROP CONSTRAINT IF EXISTS organizations_invite_code_key;
ALTER TABLE IF EXISTS ONLY public.organization_profiles DROP CONSTRAINT IF EXISTS organization_profiles_pkey;
ALTER TABLE IF EXISTS ONLY public.organization_members DROP CONSTRAINT IF EXISTS organization_members_user_id_key;
ALTER TABLE IF EXISTS ONLY public.organization_members DROP CONSTRAINT IF EXISTS organization_members_pkey;
ALTER TABLE IF EXISTS ONLY public.auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_token_hash_key;
ALTER TABLE IF EXISTS ONLY public.auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_pkey;
DROP TABLE IF EXISTS public.volunteer_profiles;
DROP TABLE IF EXISTS public.users;
DROP TABLE IF EXISTS public.registrations;
DROP TABLE IF EXISTS public.projects;
DROP TABLE IF EXISTS public.organizations;
DROP TABLE IF EXISTS public.organization_profiles;
DROP TABLE IF EXISTS public.organization_members;
DROP TABLE IF EXISTS public.auth_tokens;
DROP FUNCTION IF EXISTS public.check_project_capacity();
DROP EXTENSION IF EXISTS pgcrypto;
--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: check_project_capacity(); Type: FUNCTION; Schema: public; Owner: -
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: auth_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.auth_tokens (
    token_id integer NOT NULL,
    user_id integer NOT NULL,
    purpose character varying(32) NOT NULL,
    token_hash character(64) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    CONSTRAINT auth_tokens_purpose_check CHECK (((purpose)::text = ANY ((ARRAY['email_verification'::character varying, 'password_reset'::character varying])::text[])))
);


--
-- Name: auth_tokens_token_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.auth_tokens ALTER COLUMN token_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.auth_tokens_token_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    member_id integer NOT NULL,
    organization_id integer NOT NULL,
    user_id integer NOT NULL,
    org_role character varying(20) NOT NULL,
    status character varying(20) DEFAULT 'active'::character varying NOT NULL,
    joined_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT organization_members_org_role_check CHECK (((org_role)::text = ANY ((ARRAY['super_organizer'::character varying, 'organizer'::character varying])::text[]))),
    CONSTRAINT organization_members_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'active'::character varying])::text[])))
);


--
-- Name: organization_members_member_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ALTER COLUMN member_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.organization_members_member_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: organization_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_profiles (
    user_id integer NOT NULL,
    company_name character varying(150) NOT NULL,
    website character varying(255),
    description text,
    contact_phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    organization_id integer
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    organization_id integer NOT NULL,
    company_name character varying(150) NOT NULL,
    website character varying(255),
    description text,
    contact_phone character varying(20),
    invite_code character varying(32) NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: organizations_organization_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.organizations ALTER COLUMN organization_id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.organizations_organization_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
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
    applications_open boolean DEFAULT true NOT NULL,
    cancellation_reason text,
    version integer DEFAULT 1 NOT NULL,
    organization_id integer,
    CONSTRAINT chk_project_dates CHECK ((end_datetime > start_datetime)),
    CONSTRAINT projects_max_capacity_check CHECK ((max_capacity > 0)),
    CONSTRAINT projects_status_check CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'open'::character varying, 'full'::character varying, 'completed'::character varying, 'cancelled'::character varying])::text[])))
);


--
-- Name: projects_project_id_seq; Type: SEQUENCE; Schema: public; Owner: -
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
-- Name: registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.registrations (
    registration_id integer NOT NULL,
    user_id integer NOT NULL,
    project_id integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying NOT NULL,
    registered_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    checked_in_at timestamp without time zone,
    hours_contributed numeric(5,2),
    motivation text,
    rejection_reason text,
    CONSTRAINT registrations_hours_contributed_check CHECK ((hours_contributed >= (0)::numeric)),
    CONSTRAINT registrations_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'confirmed'::character varying, 'waitlisted'::character varying, 'cancelled'::character varying, 'attended'::character varying, 'no_show'::character varying])::text[])))
);


--
-- Name: registrations_registration_id_seq; Type: SEQUENCE; Schema: public; Owner: -
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
-- Name: users; Type: TABLE; Schema: public; Owner: -
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
    avatar_url text,
    email_verified boolean DEFAULT true NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['volunteer'::character varying, 'organizer'::character varying, 'admin'::character varying])::text[])))
);


--
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: -
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
-- Name: volunteer_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.volunteer_profiles (
    user_id integer NOT NULL,
    skills text,
    bio text,
    phone character varying(20),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Data for Name: auth_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.auth_tokens (token_id, user_id, purpose, token_hash, created_at, expires_at, used_at) FROM stdin;
2	13	email_verification	c9c44ee84b10dd74a538aa3b66bac41bfb223e1083acc54c41ddfbd760e811f3	2026-11-22 20:36:06.837169	2026-11-23 15:36:06.844992	2026-11-22 20:36:19.139905
3	14	email_verification	3651841f87edaf64f8a8bce29cf9b0941cea42dd4b42bfe16273af1f0d10ad44	2026-11-22 23:37:37.63924	2026-11-23 18:37:37.654978	2026-11-22 23:37:49.083733
4	15	email_verification	5736a3cbb74816cc31eb0c72946e0a425d020495aea75f1d323b2da6fd2854c9	2026-11-24 17:00:59.750582	2026-11-25 12:00:59.759291	2026-11-24 17:01:09.585903
\.


--
-- Data for Name: organization_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_members (member_id, organization_id, user_id, org_role, status, joined_at) FROM stdin;
1	1	3	organizer	pending	2026-11-22 10:39:57.651799
2	1	2	organizer	active	2026-11-22 10:39:57.651799
3	1	1	super_organizer	active	2026-11-22 10:39:57.651799
4	2	5	organizer	active	2026-11-22 10:39:57.651799
5	2	4	super_organizer	active	2026-11-22 10:39:57.651799
\.


--
-- Data for Name: organization_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organization_profiles (user_id, company_name, website, description, contact_phone, created_at, organization_id) FROM stdin;
1	Green Almaty Foundation	https://greenalmaty.example.org	Городская экологическая инициатива: озеленение, уборка рек и эковолонтёрство в Алматы.	+7 727 250 1010	2026-11-22 10:39:57.66755	1
2	Green Almaty Foundation	https://greenalmaty.example.org	Городская экологическая инициатива: озеленение, уборка рек и эковолонтёрство в Алматы.	+7 727 250 1010	2026-11-22 10:39:57.66755	1
4	Qamqor Care	https://qamqor.example.kz	Социальная помощь, поддержка приютов для животных и образовательные программы.	+7 717 240 2020	2026-11-22 10:39:57.66755	2
5	Qamqor Care	https://qamqor.example.kz	Социальная помощь, поддержка приютов для животных и образовательные программы.	+7 717 240 2020	2026-11-22 10:39:57.66755	2
14	Ben Company	\N	\N	\N	2026-11-22 23:37:37.63924	\N
\.


--
-- Data for Name: organizations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.organizations (organization_id, company_name, website, description, contact_phone, invite_code, created_at) FROM stdin;
1	Green Almaty Foundation	https://greenalmaty.example.org	Городская экологическая инициатива: озеленение, уборка рек и эковолонтёрство в Алматы.	+7 727 250 1010	GREEN001	2026-11-22 10:39:57.550027
2	Qamqor Care	https://qamqor.example.kz	Социальная помощь, поддержка приютов для животных и образовательные программы.	+7 717 240 2020	QAMQOR02	2026-11-22 10:39:57.550027
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (project_id, organizer_id, title, description, address, city, is_remote, start_datetime, end_datetime, max_capacity, status, created_at, deleted_at, category, applications_open, cancellation_reason, version, organization_id) FROM stdin;
1	1	Осенняя очистка тропы на Кок-Жайляу	Сбор мусора на туристическом маршруте и обновление информационных табличек.	Ущелье Казачка	Almaty	f	2026-11-17 10:39:57.693549	2026-11-17 14:39:57.693549	6	open	2026-11-22 10:39:57.693549	\N	Environment	t	\N	1	1
2	1	Велопробег за чистый воздух	Городской экологический велопробег по центральным улицам.	Площадь Республики	Almaty	f	2026-12-04 10:39:57.693549	2026-12-04 13:39:57.693549	20	cancelled	2026-11-22 10:39:57.693549	\N	Community	f	Мероприятие перенесено из-за прогноза сильного дождя и перекрытия дороги.	1	1
3	1	Сортировка вторсырья на складе	Помощь в упаковке собранной макулатуры и пластиковых крышек перед отправкой на завод.	пр. Рыскулова, 72	Almaty	f	2026-12-02 10:39:57.693549	2026-12-02 15:39:57.693549	15	open	2026-11-22 10:39:57.693549	\N	Environment	f	\N	1	1
4	1	Посадка деревьев в Ботаническом саду	Высаживаем 80 саженцев дуба и клёна. Перчатки, лопаты и горячий чай предоставляем на месте.	ул. Тимирязева, 36Д	Almaty	f	2026-11-25 10:39:57.693549	2026-11-25 14:39:57.693549	8	open	2026-11-22 10:39:57.693549	\N	Environment	t	\N	1	1
6	2	Уборка берега Большой Алматинки	Раздельный сбор пластика и стекла вдоль набережной. Сделаем прогулочную зону чистой.	Набережная вдоль ул. Навои	Almaty	f	2026-11-28 10:39:57.693549	2026-11-28 13:39:57.693549	12	open	2026-11-22 10:39:57.693549	\N	Environment	t	\N	1	1
7	4	Марафон доброты — точка воды	Раздача воды, фруктов и поддержка бегунов на пятом километре благотворительной дистанции.	Триатлон парк	Astana	f	2026-12-07 10:39:57.693549	2026-12-07 15:39:57.693549	25	open	2026-11-22 10:39:57.693549	\N	Healthcare	t	\N	1	2
8	4	Помощь в ветеринарном приюте Лапа	Выгул собак, уборка вольеров и утепление будок к зиме. Можно принести корм.	ул. Кенесары, 95	Astana	f	2026-11-26 10:39:57.693549	2026-11-26 14:39:57.693549	6	open	2026-11-22 10:39:57.693549	\N	Animals	t	\N	1	2
9	5	Сбор продуктовых наборов для семей	Фасовка и доставка продуктовых корзин малообеспеченным семьям и одиноким пенсионерам.	пр. Тауке хана, 51	Shymkent	f	2026-11-29 10:39:57.693549	2026-11-29 14:39:57.693549	5	open	2026-11-22 10:39:57.693549	\N	Community	t	\N	1	2
10	5	Цифровая грамотность для пенсионеров	Помогаем пожилым людям настроить eGov, WhatsApp и защиту от телефонных мошенников.	пр. Мангилик Ел, 44	Astana	f	2026-12-01 10:39:57.693549	2026-12-01 12:39:57.693549	10	open	2026-11-22 10:39:57.693549	\N	Education	t	\N	1	2
5	2	Эко-лекторий для школьников	Интерактивный урок о сортировке отходов и переработке пластика в школе №25.	ул. Кабанбай батыра, 128	Almaty	f	2026-11-30 10:39:57.693549	2026-11-30 12:39:57.693549	2	full	2026-11-22 10:39:57.693549	\N	Education	t	\N	1	1
\.


--
-- Data for Name: registrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.registrations (registration_id, user_id, project_id, status, registered_at, checked_in_at, hours_contributed, motivation, rejection_reason) FROM stdin;
1	8	1	attended	2026-11-22 10:39:57.712151	2026-11-17 10:39:57.712151	4.00	Возьму с собой трекинговые палки и помогу нести собранный мусор вниз.	\N
2	6	1	attended	2026-11-22 10:39:57.712151	2026-11-17 10:39:57.712151	4.50	Хожу в горы каждые выходные, знаю маршрут и хочу помочь очистить тропу.	\N
3	8	2	cancelled	2026-11-22 10:39:57.712151	\N	\N	Готов ехать замыкающим с аптечкой и минимальным набором инструментов.	\N
4	7	2	cancelled	2026-11-22 10:39:57.712151	\N	\N	У меня есть свой велосипед и шлем, с радостью помогу в сопровождении колонны.	\N
5	10	3	pending	2026-11-22 10:39:57.712151	\N	\N	Успел подать заявку до закрытия набора, очень хочу поучаствовать в смене.	\N
6	6	3	confirmed	2026-11-22 10:39:57.712151	\N	\N	Уже работал на складе вторсырья, знаю правила сортировки ПЭТ и картона.	\N
7	10	4	cancelled	2026-11-22 10:39:57.712151	\N	\N	Могу прийти только на последний час мероприятия, если ещё нужна будет помощь.	Нужны волонтеры на полную смену с начала инструктажа.
8	9	4	pending	2026-11-22 10:39:57.712151	\N	\N	Очень люблю ботанический сад и хочу внести свой вклад в сохранение зеленого пояса.	\N
9	8	4	pending	2026-11-22 10:39:57.712151	\N	\N	Свободен в этот день с самого утра, готов выполнять любую физическую работу на участке.	\N
10	7	4	confirmed	2026-11-22 10:39:57.712151	\N	\N	Хочу помочь с озеленением родного города и сделать фотоотчет для соцсетей фонда.	\N
11	6	4	confirmed	2026-11-22 10:39:57.712151	\N	\N	Имею большой опыт посадки деревьев, могу привезти свои перчатки и помочь с координацией новичков.	\N
12	9	5	confirmed	2026-11-22 10:39:57.712151	\N	\N	Учусь на педагога, легко нахожу общий язык со школьниками и умею вести викторины.	\N
13	7	5	confirmed	2026-11-22 10:39:57.712151	\N	\N	Подготовлю яркую презентацию с картинками для учеников 5-6 классов.	\N
14	9	6	confirmed	2026-11-22 10:39:57.712151	\N	\N	Умею организовать раздельный сбор и объяснить участникам маркировку пластика.	\N
15	8	6	confirmed	2026-11-22 10:39:57.712151	\N	\N	Готов помочь с выносом тяжелых мешков до точки погрузки мусора.	\N
16	6	6	pending	2026-11-22 10:39:57.712151	\N	\N	Живу рядом с набережной, регулярно выхожу на такие субботники и знаю участок.	\N
17	9	7	pending	2026-11-22 10:39:57.712151	\N	\N	Свободна в воскресенье утром и хочу стать частью команды забега.	\N
18	8	7	confirmed	2026-11-22 10:39:57.712151	\N	\N	Помогу заранее разгрузить коробки с водой и установить столы на точке.	\N
19	7	7	confirmed	2026-11-22 10:39:57.712151	\N	\N	Отвечаю за заряд энергии, улыбки участников и быструю подачу стаканчиков.	\N
20	6	7	confirmed	2026-11-22 10:39:57.712151	\N	\N	Есть опыт работы на спортивных стартах и базовые навыки первой помощи.	\N
21	7	8	pending	2026-11-22 10:39:57.712151	\N	\N	Сделаю красивые фотографии собак из приюта, чтобы им быстрее нашли дом.	\N
22	6	8	pending	2026-11-22 10:39:57.712151	\N	\N	Буду в командировке в Астане в эти даты и хочу провести субботу с пользой.	\N
23	10	8	confirmed	2026-11-22 10:39:57.712151	\N	\N	Могу помочь с мелким ремонтом вольеров и утеплением будок перед морозами.	\N
24	9	8	confirmed	2026-11-22 10:39:57.712151	\N	\N	Очень люблю животных, раньше часто помогала в приютах на выходных.	\N
25	6	9	pending	2026-11-22 10:39:57.712151	\N	\N	Готов помочь с фасовкой продуктов на складе в первой половине дня.	\N
26	10	9	confirmed	2026-11-22 10:39:57.712151	\N	\N	Надежный и аккуратный водитель, помогу развезти пакеты по адресам в центре.	\N
27	8	10	pending	2026-11-22 10:39:57.712151	\N	\N	Могу помогать участникам индивидуально, отвечая на вопросы по их смартфонам.	\N
28	10	10	confirmed	2026-11-22 10:39:57.712151	\N	\N	Работаю в IT и спокойно, терпеливо объясняю сложные темы пожилым людям.	\N
29	13	1	pending	2026-11-22 20:40:37.845741	\N	\N	аааааааааывфыавыавыавы	\N
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (user_id, full_name, email, password_hash, role, phone, is_active, created_at, last_login, avatar_url, email_verified) FROM stdin;
1	Айгерим Султанова	super1@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	organizer	+7 701 111 0001	t	2026-11-22 10:39:57.577556	\N	\N	t
2	Данияр Беков	org1@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	organizer	+7 701 111 0002	t	2026-11-22 10:39:57.577556	\N	\N	t
3	Мадина Касымова	org1_pending@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	organizer	+7 701 111 0003	t	2026-11-22 10:39:57.577556	\N	\N	t
4	Тимур Алиев	super2@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	organizer	+7 702 222 0001	t	2026-11-22 10:39:57.577556	\N	\N	t
5	Елена Ким	org2@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	organizer	+7 702 222 0002	t	2026-11-22 10:39:57.577556	\N	\N	t
6	Арман Сериков	vol1@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	volunteer	+7 707 300 0001	t	2026-11-22 10:39:57.577556	\N	\N	t
7	Алина Нурлан	vol2@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	volunteer	+7 707 300 0002	t	2026-11-22 10:39:57.577556	\N	\N	t
8	Максим Петров	vol3@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	volunteer	+7 707 300 0003	t	2026-11-22 10:39:57.577556	\N	\N	t
9	Динара Жумабаева	vol4@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	volunteer	+7 707 300 0004	t	2026-11-22 10:39:57.577556	\N	\N	t
10	Руслан Омаров	vol5@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	volunteer	+7 707 300 0005	t	2026-11-22 10:39:57.577556	\N	\N	t
11	Санжар Тест (не подтвержден)	vol6_unverified@helpinghands.test	$2a$10$jZFCiwg0pLnYaBh5I4RNmudCK2z./Mb5JeRj.YgkYGJVV2zrZm2W.	volunteer	+7 707 300 0006	t	2026-11-22 10:39:57.577556	\N	\N	f
13	Bob	bob@mail.com	$2b$12$xhq4l/qEfPgiuQcxL1jmh.PTGvn9Mw9CHX6uabsRL8I5Pivq7ng9e	volunteer	\N	t	2026-11-22 20:36:06.837169	\N	\N	t
14	Ben	ben@mail.com	$2b$12$FMK0itnJ/5jANnVtKEMVm.mO79MQbAGNtwoB9DalPl53.Di613/Oe	organizer	\N	t	2026-11-22 23:37:37.63924	\N	\N	t
15	bob2	bob2@mail.com	$2b$12$T8UIzy..aobKbYKteIhnQO/TZL8DYGX9lIHyP7fMlp98ORooA1K1a	volunteer	\N	t	2026-11-24 17:00:59.750582	\N	\N	t
\.


--
-- Data for Name: volunteer_profiles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.volunteer_profiles (user_id, skills, bio, phone, created_at) FROM stdin;
6	Координация, первая помощь, водительские права B	Участвую в эко-акциях с 2023 года.	+7 707 300 0001	2026-11-22 10:39:57.677554
7	Фотосъёмка, SMM, организация мероприятий	Люблю помогать приютам и вести репортажи.	+7 707 300 0002	2026-11-22 10:39:57.677554
8	Логистика, физическая помощь, ремонт	Готов выезжать на субботники по выходным.	+7 707 300 0003	2026-11-22 10:39:57.677554
9	Педагогика, английский язык, работа с детьми	Студентка педвуза, провожу мастер-классы.	+7 707 300 0004	2026-11-22 10:39:57.677554
10	IT-поддержка, настройка компьютеров	Помогаю старшему поколению осваивать смартфоны.	+7 707 300 0005	2026-11-22 10:39:57.677554
11	Начинающий волонтер	Только зарегистрировался на платформе.	+7 707 300 0006	2026-11-22 10:39:57.677554
13	\N	\N	\N	2026-11-22 20:36:06.837169
15	\N	\N	\N	2026-11-24 17:00:59.750582
\.


--
-- Name: auth_tokens_token_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.auth_tokens_token_id_seq', 4, true);


--
-- Name: organization_members_member_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organization_members_member_id_seq', 5, true);


--
-- Name: organizations_organization_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.organizations_organization_id_seq', 2, true);


--
-- Name: projects_project_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.projects_project_id_seq', 10, true);


--
-- Name: registrations_registration_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.registrations_registration_id_seq', 29, true);


--
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.users_user_id_seq', 15, true);


--
-- Name: auth_tokens auth_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_pkey PRIMARY KEY (token_id);


--
-- Name: auth_tokens auth_tokens_token_hash_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (member_id);


--
-- Name: organization_members organization_members_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_key UNIQUE (user_id);


--
-- Name: organization_profiles organization_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_profiles
    ADD CONSTRAINT organization_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: organizations organizations_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_invite_code_key UNIQUE (invite_code);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (organization_id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (project_id);


--
-- Name: registrations registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT registrations_pkey PRIMARY KEY (registration_id);


--
-- Name: registrations uq_user_project; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT uq_user_project UNIQUE (user_id, project_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: volunteer_profiles volunteer_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_profiles
    ADD CONSTRAINT volunteer_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: idx_projects_city; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_city ON public.projects USING btree (city);


--
-- Name: idx_projects_organizer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_organizer ON public.projects USING btree (organizer_id);


--
-- Name: idx_projects_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_start ON public.projects USING btree (start_datetime);


--
-- Name: idx_reg_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reg_project ON public.registrations USING btree (project_id);


--
-- Name: uq_one_super_organizer_per_org; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_one_super_organizer_per_org ON public.organization_members USING btree (organization_id) WHERE (((org_role)::text = 'super_organizer'::text) AND ((status)::text = 'active'::text));


--
-- Name: registrations trg_check_capacity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_capacity BEFORE INSERT OR UPDATE OF status, project_id ON public.registrations FOR EACH ROW EXECUTE FUNCTION public.check_project_capacity();


--
-- Name: auth_tokens auth_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.auth_tokens
    ADD CONSTRAINT auth_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: projects fk_projects_organizer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT fk_projects_organizer FOREIGN KEY (organizer_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: registrations fk_reg_project; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT fk_reg_project FOREIGN KEY (project_id) REFERENCES public.projects(project_id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: registrations fk_reg_user; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.registrations
    ADD CONSTRAINT fk_reg_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: organization_profiles organization_profiles_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_profiles
    ADD CONSTRAINT organization_profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE SET NULL;


--
-- Name: organization_profiles organization_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_profiles
    ADD CONSTRAINT organization_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(organization_id) ON DELETE CASCADE;


--
-- Name: volunteer_profiles volunteer_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.volunteer_profiles
    ADD CONSTRAINT volunteer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict O7tGm99E3qlUWE55riofUHuLAsZfPBnWCzg6w0amEYJ2xJLBqxF5d0UC0dvLypB

