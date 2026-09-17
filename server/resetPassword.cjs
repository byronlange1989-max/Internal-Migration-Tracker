#!/usr/bin/env node
/**
 * Internal Migration Tracker - User & Password Management CLI
 * 
 * Usage:
 *   node server/resetPassword.js --list
 *   node server/resetPassword.js <username> <new_password>
 *   node server/resetPassword.js admin admin123
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getAppRoot() {
  if (fs.existsSync(path.join(__dirname, '..', 'package.json'))) {
    return path.join(__dirname, '..');
  }
  if (fs.existsSync(path.join(process.cwd(), 'package.json'))) {
    return process.cwd();
  }
  return path.join(__dirname, '..');
}

const APP_ROOT = getAppRoot();
const USERS_PATH = path.join(APP_ROOT, 'server', 'storedUsers.json');

function hashPassword(password, salt) {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 1000, 64, 'sha512').toString('hex');
  return { salt: actualSalt, hash };
}

function loadUsers() {
  if (!fs.existsSync(USERS_PATH)) {
    console.error(`Error: Users file not found at ${USERS_PATH}`);
    process.exit(1);
  }
  try {
    const raw = fs.readFileSync(USERS_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error parsing ${USERS_PATH}:`, err.message);
    process.exit(1);
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_PATH, JSON.stringify(users, null, 2), 'utf-8');
  console.log(`[OK] Successfully updated ${USERS_PATH}`);
}

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
Internal Migration Tracker - Password Reset Utility
===================================================
Commands:
  node server/resetPassword.js --list
      Lists all registered users and roles.

  node server/resetPassword.js <username> <new_password>
      Sets a new password for the specified user.
      Example: node server/resetPassword.js admin admin123
      Example: node server/resetPassword.js ironadmin admin123

  node server/resetPassword.js --reset-all-defaults
      Resets passwords for all admin accounts to 'admin123'.
`);
  process.exit(0);
}

const users = loadUsers();

if (args[0] === '--list' || args[0] === '-l') {
  console.log(`\nRegistered Users in ${USERS_PATH}:`);
  console.log('---------------------------------------------------------------------');
  console.log('Username'.padEnd(16) + 'Role'.padEnd(12) + 'Display Name'.padEnd(24) + 'Last Login');
  console.log('---------------------------------------------------------------------');
  users.forEach(u => {
    console.log(
      (u.username || '').padEnd(16) +
      (u.role || '').padEnd(12) +
      (u.displayName || '').padEnd(24) +
      (u.lastLogin || 'Never')
    );
  });
  console.log('---------------------------------------------------------------------\n');
  process.exit(0);
}

if (args[0] === '--reset-all-defaults') {
  users.forEach(u => {
    const creds = hashPassword('admin123');
    u.salt = creds.salt;
    u.hash = creds.hash;
  });
  saveUsers(users);
  console.log('[OK] Reset all accounts to password: admin123');
  process.exit(0);
}

const targetUser = args[0].trim().toLowerCase();
const newPassword = args[1];

if (!newPassword) {
  console.error('Error: Please provide a new password.');
  console.error(`Usage: node server/resetPassword.js ${targetUser} <new_password>`);
  process.exit(1);
}

const user = users.find(u => (u.username || '').toLowerCase() === targetUser);

if (!user) {
  console.log(`User '${targetUser}' not found. Creating new admin user '${targetUser}'...`);
  const creds = hashPassword(newPassword);
  users.push({
    id: `user-${Date.now()}`,
    username: targetUser,
    displayName: targetUser.charAt(0).toUpperCase() + targetUser.slice(1),
    role: 'admin',
    salt: creds.salt,
    hash: creds.hash,
    createdAt: new Date().toISOString(),
    lastLogin: null
  });
  saveUsers(users);
  console.log(`[OK] Created new admin user '${targetUser}' with your password.`);
  process.exit(0);
}

const creds = hashPassword(newPassword);
user.salt = creds.salt;
user.hash = creds.hash;
saveUsers(users);

console.log(`[OK] Successfully reset password for user '${user.username}' (${user.role}).`);
