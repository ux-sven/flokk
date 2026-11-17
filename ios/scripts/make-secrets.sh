#!/bin/sh
# Lager ios/Flokk/Secrets.swift fra webappens .env.local (filen er gitignorert).
# Kjør fra repo-roten:  sh ios/scripts/make-secrets.sh
set -e
ENV_FILE="$(dirname "$0")/../../.env.local"
URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
KEY=$(grep '^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
SITE=$(grep '^NEXT_PUBLIC_SITE_URL=' "$ENV_FILE" | cut -d= -f2- | tr -d '"')
# Valgfri: offentlig iOS-nøkkel fra RevenueCat (appl_…). Uten den er kjøp av Flokk Pluss slått av.
RC=$(grep '^REVENUECAT_IOS_KEY=' "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
cat > "$(dirname "$0")/../Flokk/Secrets.swift" <<SWIFT
// Generert av ios/scripts/make-secrets.sh – ikke sjekk inn.
enum Secrets {
    static let supabaseURL = "$URL"
    static let supabaseKey = "$KEY"
    static let siteURL = "$SITE"
    static let revenueCatKey = "$RC"
}
SWIFT
echo "Skrev ios/Flokk/Secrets.swift"
