const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Installing dependencies...');

try {
  // Check if package-lock.json exists
  const lockFileExists = fs.existsSync('package-lock.json');
  console.log(`package-lock.json exists: ${lockFileExists}`);
  
  // Use npm install instead of npm ci for more flexibility
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install dependencies:', error.message);
  process.exit(1);
}
