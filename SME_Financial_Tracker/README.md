# Ledgerly — SME Financial Tracker

A PHP 8.2+ and SQLite application with separate owner, staff and supplier workspaces.

## Run with XAMPP

1. Keep this folder at `C:\xampp\htdocs\SME_Financial_Tracker`.
2. Start **Apache** in the XAMPP Control Panel.
3. Open `http://localhost/SME_Financial_Tracker/`.
4. Click **Register your business** to open the registration page. Enter your owner name, business name, username and a password of at least 10 characters. Login uses only username and password.
5. Use **Team & access** to add staff and supplier accounts. There are no built-in passwords.

The database and tables are created automatically at `data/ledgerly.sqlite`. MySQL and Composer are not required. PHP must have PDO SQLite and mbstring enabled; the installed XAMPP PHP includes them. Apache must honor the provided `.htaccess` files to protect the database directory. Do not open the HTML files directly from the filesystem.

Alternatively, from this directory:

```powershell
C:\xampp\php\php.exe -S 127.0.0.1:8080 router.php
```

Then open `http://127.0.0.1:8080/`. Use the router when running the PHP development server; it prevents access to private data and test files.

## Workflows

- **Owner:** record transactions; approve or reject staff submissions; set recurring monthly budgets; filter and export reports; maintain the preparation checklist; manage accounts and workspace details.
- **Staff:** submit income and expenses and view their own submissions. Pending and rejected submissions do not contribute to financial totals.
- **Supplier:** view only assigned purchase orders, confirm them, mark them delivered, submit one invoice per delivered order, and view recorded payments. Invoice totals match purchase order totals.
- **Orders and payments:** the owner creates an order for an active supplier. After delivery and invoice submission, the owner records a payment. This marks the invoice and order paid and creates one approved expense atomically. Pay the supplier outside the system before recording payment here.
- **Reports:** dashboard totals include approved transactions across all dates. Budgets show approved expenses for the current month. Report date filters control summary cards and CSV export; the cash flow chart separately shows the last three or six calendar months.
- **Account passwords:** open the workspace guide or owner Settings to change your own password. Disabling an account immediately blocks its API access and retains its records.

The preparation checklist organizes records; it does not calculate tax obligations or file returns. This is one business workspace per installation. Browser demo data is not imported into the server database.

## Validation

```powershell
node tests/frontend.mjs
node tests/integration.mjs
```

Integration checks start a temporary PHP server on loopback with a separate temporary SQLite database and remove the fixture afterward. Set `PHP_BINARY` if PHP is installed elsewhere. They cover authentication, CSRF, role restrictions, staff record isolation, approvals, invalid amounts and dates, supplier order isolation, invoice validation, duplicate payments, account disabling, password changes and persistence.

## Data and hosting

Back up `data/ledgerly.sqlite` while writes are stopped. Keep the database outside published source archives and preserve `.htaccess` protections. For a hosted installation, use HTTPS and give the PHP process write access only to the data directory. Session cookies are HTTP-only, same-site restricted, and secure when served over HTTPS; sessions expire after eight hours without activity. Sign-in attempts are limited per IP.



## Sharing with groupmates

Upload the extracted project source to GitHub, including hidden `.htaccess` files and `.gitignore`. Each groupmate should place the project folder under XAMPP `htdocs`, start Apache, and open `http://localhost/SME_Financial_Tracker/`. Click **Register your business** to create their owner account, then add staff and supplier accounts under **Team & access**.

The share package contains a clean SQLite schema at `database/ledgerly.sql`. It contains no saved accounts, password hashes, login attempts, or financial data. The application creates its database automatically, so manual import is optional. This SQL file is for **SQLite**, not MySQL or phpMyAdmin. If using a SQLite database editor, create `data/ledgerly.sqlite` and execute `database/ledgerly.sql` against it before registration.

Keep local `data/*.sqlite*` files out of GitHub; `.gitignore` excludes them. Each installation has its own database. Putting the project on GitHub shares source code; running PHP requires XAMPP or another PHP server.
