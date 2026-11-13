import { randomInt } from 'node:crypto';

export const PASSWORD_ERROR = 'Задайте пароль длиной от 4 до 8 символов без пробелов по краям.';
export function validAccessPassword(value) {
  return typeof value === 'string' && value === value.trim() && value.length >= 4 && value.length <= 8 && !/[\r\n\t\x00]/.test(value);
}
export function shortAccessPassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  return Array.from({length:8},()=>alphabet[randomInt(alphabet.length)]).join('');
}

export function enforceSinglePasswordSchema(db) {
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS one_primary_password_per_scope ON grants(scope) WHERE scope<>'archive:owner';
    CREATE UNIQUE INDEX IF NOT EXISTS one_additional_password_per_scope ON additional_grants(scope) WHERE scope<>'archive:owner';
    CREATE TRIGGER IF NOT EXISTS one_password_primary_insert BEFORE INSERT ON grants
      WHEN NEW.scope<>'archive:owner' AND EXISTS(SELECT 1 FROM additional_grants WHERE scope=NEW.scope)
      BEGIN SELECT RAISE(ABORT,'Only one password per access scope'); END;
    CREATE TRIGGER IF NOT EXISTS one_password_primary_update BEFORE UPDATE OF scope,key_hash ON grants
      WHEN NEW.scope<>'archive:owner' AND EXISTS(SELECT 1 FROM additional_grants WHERE scope=NEW.scope)
      BEGIN SELECT RAISE(ABORT,'Only one password per access scope'); END;
    CREATE TRIGGER IF NOT EXISTS one_password_additional_insert BEFORE INSERT ON additional_grants
      WHEN NEW.scope<>'archive:owner' AND EXISTS(SELECT 1 FROM grants WHERE scope=NEW.scope)
      BEGIN SELECT RAISE(ABORT,'Only one password per access scope'); END;
    CREATE TRIGGER IF NOT EXISTS one_password_additional_update BEFORE UPDATE OF scope,key_hash ON additional_grants
      WHEN NEW.scope<>'archive:owner' AND EXISTS(SELECT 1 FROM grants WHERE scope=NEW.scope)
      BEGIN SELECT RAISE(ABORT,'Only one password per access scope'); END;
  `);
}
