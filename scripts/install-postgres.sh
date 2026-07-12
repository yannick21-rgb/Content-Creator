#!/bin/bash
set -euo pipefail

echo "=== Installation de PostgreSQL ==="
echo ""
echo "Ce script va installer PostgreSQL 16 avec votre mot de passe sudo."
echo ""

if ! sudo -n true 2>/dev/null; then
  echo "Mot de passe sudo nécessaire."
  echo "Veuillez exécuter cette commande dans votre terminal :"
  echo ""
  echo "  sudo apt-get install -y postgresql postgresql-contrib"
  echo ""
  echo "Puis :"
  echo "  sudo service postgresql start"
  echo "  sudo -u postgres createuser --superuser jhpy 2>/dev/null || true"
  echo "  createdb content_creator 2>/dev/null || true"
  echo "  createdb content_creator_test 2>/dev/null || true"
  exit 1
fi
