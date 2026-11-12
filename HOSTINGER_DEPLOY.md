# Deploy Edison HRM to Hostinger

This is a Laravel application. A static Vite deployment serves only frontend assets and cannot run the HRM. These instructions use Hostinger Web/Cloud hosting with SSH, MySQL and PHP 8.2 or later.

## Layout

Keep the application outside the public web directory. The deployment helper expects this exact sibling layout:

```text
/home/ACCOUNT/domains/DOMAIN/
  edison-hrm/       Laravel project (artisan, .env, vendor, storage)
  public_html/      only public files and the front controller
```

Back up any existing site and database before replacing them. Do not upload your local `.env`, `public/hot`, local caches, or credentials. The application and public paths must stay at the locations above. The helper refuses to overwrite an unrelated `public_html/index.php` or a real `public_html/storage` directory; inspect and move old site files aside first.

## First deployment

1. Create a MySQL database and user in hPanel. Configure the domain and SSL. Set PHP 8.2 or later and ensure required extensions are enabled (including pdo_mysql, mbstring, curl, gd, zip and XML). Confirm the PHP version used by SSH as well as the website.
2. Upload the project to the `edison-hrm` directory. Include `config/app.php` and `config/verification.php`, which are required application configuration files. Do not expose this directory publicly.
3. In SSH, from `edison-hrm`, create the production environment file:

   ```sh
   cp .env.example .env
   ```

   Set `APP_URL` to the actual HTTPS domain and set the database credentials in `.env`. Keep `APP_DEBUG=false`. Set `IS_SAAS` to match the source installation. Configure SMTP if you need email. Quote values containing spaces or special characters.
4. Install the locked PHP dependencies with `composer2 install --no-dev --optimize-autoloader`. Build assets with `npm ci && npm run build` if Node is available on the server. Otherwise build on the development machine and upload the resulting `public/build` directory. Never upload `public/hot`.
5. **For a new empty database only**, run `php artisan key:generate` once, then `php artisan migrate --force`. Seed data only if deliberately setting up a fresh system. For a transfer of the existing Edison company and employees, import a backup of the existing database and public uploads instead. Preserve the existing `APP_KEY` securely when migrating existing encrypted data; do not generate a replacement key. After restoring, run `php artisan migrate --force` for any pending migrations. Do not run `migrate:fresh` or seeders against existing data.
6. Ensure `storage` and `bootstrap/cache` are writable by PHP. After the database is ready, create `storage/installed` to bypass the installer for this existing application:

   ```sh
   mkdir -p storage/app/public storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs bootstrap/cache
   touch storage/installed
   php artisan optimize:clear
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

7. Publish the public files:

   ```sh
   sh deploy/hostinger/publish-public.sh
   ```

   The helper copies `public/` into `public_html`, installs the front controller, and creates a `public_html/storage` symlink to `storage/app/public`. On later deployments it updates public files but intentionally does not delete older files.
8. In hPanel, add a custom cron job every minute, replacing the account, domain and PHP path with your server values:

   ```sh
   cd /home/ACCOUNT/domains/DOMAIN/edison-hrm && /usr/bin/php artisan schedule:run >> /dev/null 2>&1
   ```

   The scheduler runs configured automatic backups. Hostinger cron runs in UTC; Laravel applies the backup timezone from `BACKUP_SCHEDULE_TIMEZONE`.
9. Open the site over HTTPS, sign in, and check the dashboard, attendance, payroll and an uploaded file. Verify automatic backups and email separately. Keep backups outside public web directories.

## Updating an existing deployment

Back up the database and uploaded files, upload the updated code, install locked dependencies and build assets. Then run `php artisan migrate --force`, clear and rebuild the caches as above, and run `sh deploy/hostinger/publish-public.sh`. Keep `.env`, `APP_KEY`, `storage/installed` and `storage/app` intact.

See [Hostinger's Laravel deployment guidance](https://support.hostinger.com/en/articles/6152127-how-to-deploy-laravel-8-at-hostinger) and [cron instructions](https://support.hostinger.com/en/articles/1583465-how-to-set-up-a-cron-job-at-hostinger). Hostinger's guide covers an older Laravel version; follow this project's PHP and layout requirements above.
