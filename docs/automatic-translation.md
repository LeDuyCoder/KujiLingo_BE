# Automatic display-language translation

KujiLingo translates course and lesson display copy, plus dictionary meanings, to the language sent in the `Accept-Language` request header. Original course and vocabulary records remain unchanged; translated strings are cached separately.

## Provider setup

The backend uses Google Cloud Translation Basic (NMT). Create a Google Cloud project, enable Cloud Translation API, create a restricted API key, and set these backend environment variables:

```env
GOOGLE_TRANSLATE_API_KEY=your-translation-api-key
TRANSLATION_MONTHLY_CHARACTER_LIMIT=500000
```

The translation key is separate from the Google OAuth client credentials. The backend reserves character usage in PostgreSQL before each provider request and refuses new translations after the configured monthly limit. Existing cached translations continue to work after the limit is reached. Keep the limit at or below 500,000 characters to stay within Google's published monthly NMT free allowance. Google Cloud requires billing to be enabled, and the provider may still charge if its billing period or counted characters differ from this application's meter; set a Cloud budget alert as an additional safeguard.

From PowerShell, apply the migration with `.\node_modules\.bin\prisma.cmd migrate deploy`, then regenerate the client with `.\node_modules\.bin\prisma.cmd generate`.

## Behavior when translation is unavailable

If no translation API key is configured, the provider is unavailable, or the monthly limit has been reached, the API returns the stored source text. The UI stays usable and original content remains intact.

Official references: [Cloud Translation pricing](https://cloud.google.com/translate/pricing), [supported languages](https://cloud.google.com/translate/docs/languages), and [Basic translate API](https://cloud.google.com/translate/docs/reference/rest/v2/translate).
