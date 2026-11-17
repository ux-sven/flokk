#!/bin/sh
# Xcode Cloud: lager Flokk/Secrets.swift fra miljøvariabler i workflowen,
# siden filen ikke ligger i git. Sett disse i App Store Connect → Xcode Cloud →
# workflow → Environment: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SITE_URL.
set -e
: "${SUPABASE_URL:?Mangler SUPABASE_URL i Xcode Cloud-workflowen}"
: "${SUPABASE_PUBLISHABLE_KEY:?Mangler SUPABASE_PUBLISHABLE_KEY i Xcode Cloud-workflowen}"
: "${SITE_URL:?Mangler SITE_URL i Xcode Cloud-workflowen}"
cat > "$CI_PRIMARY_REPOSITORY_PATH/ios/Flokk/Secrets.swift" <<SWIFT
// Generert av ios/ci_scripts/ci_post_clone.sh i Xcode Cloud.
enum Secrets {
    static let supabaseURL = "$SUPABASE_URL"
    static let supabaseKey = "$SUPABASE_PUBLISHABLE_KEY"
    static let siteURL = "$SITE_URL"
}
SWIFT
echo "Skrev ios/Flokk/Secrets.swift"
