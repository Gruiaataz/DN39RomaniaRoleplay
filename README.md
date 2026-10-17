# DN39 Romania Roleplay — website

Site complet, responsive, în limba română, cu panou de administrare pentru anunțuri și aplicații.

## Funcționalități
- Pagina principală cu identitatea DN39, logo și animații.
- Autentificare owner pe server; parola nu este pusă în codul frontend.
- Panou owner: publică/șterge anunțuri, setează disponibilitatea și numărul de locuri pentru IPJ, ISU și Staff.
- Modificările se salvează în SQLite și sunt afișate automat vizitatorilor.
- Secțiune shop cu prețuri orientative; nu procesează plăți.
- Butoane IPJ/ISU către Discord și link configurabil pentru aplicația Staff.
- Protecții de bază: Helmet, rate limiting la login, cookie de sesiune HttpOnly.

## Pornire locală
Necesită Node.js 20+.

```bash
npm install
cp .env.example .env
```

Editează `.env`: setează `SESSION_SECRET` și `OWNER_PASSWORD` cu valori puternice. Apoi:

```bash
npm start
```

Deschide `http://localhost:3000`.

## Publicare pe GitHub și Render
1. Dezarhivează proiectul și creează un repository GitHub.
2. Încarcă fișierele proiectului. **Nu încărca niciodată `.env`**; este ignorat de `.gitignore`.
3. În Render, alege **New → Blueprint** și conectează repository-ul. Render va citi `render.yaml`.
4. La variabila `OWNER_PASSWORD`, setează parola de owner în Render Environment. Setează și `SESSION_SECRET` dacă Render nu l-a generat automat.
5. Verifică `STAFF_APPLICATION_URL` și înlocuiește-l cu linkul real al formularului Staff când îl ai.
6. Deploy. SQLite este stocat pe discul persistent `/var/data`.

## Contul owner
Username implicit: `OwnerDn39RomaniaRoleplay`.
Parola se setează în variabila de mediu `OWNER_PASSWORD`, nu în fișierele publice. Dacă parola furnizată în conversație este cea dorită, introdu-o manual în Render Environment sau în `.env` local. Nu o publica pe GitHub.

## Important
- Linkul de aplicație Staff nu a fost furnizat efectiv în mesaj, așa că proiectul folosește temporar linkul Discord și îl poți schimba din `STAFF_APPLICATION_URL`.
- Shop-ul este doar o listă de produse/prețuri. Nu încasează bani și nu acordă automat beneficii.
- Pentru securitate, schimbă parola dacă a fost distribuită public și folosește HTTPS în producție.
