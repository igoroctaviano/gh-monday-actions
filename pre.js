const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Installing dependencies...');
console.log('Current working directory:', process.cwd());

try {
  // Get the directory where this script is located (the action's directory)
  const actionDir = __dirname;
  console.log('Action directory:', actionDir);
  
  // Change to the action's directory
  process.chdir(actionDir);
  console.log('Changed to action directory:', process.cwd());
  
  // Check if package.json exists in the action directory
  const packageJsonExists = fs.existsSync('package.json');
  const lockFileExists = fs.existsSync('package-lock.json');
  console.log(`package.json exists: ${packageJsonExists}`);
  console.log(`package-lock.json exists: ${lockFileExists}`);
  
  if (!packageJsonExists) {
    throw new Error('package.json not found in action directory');
  }
  
  // Use npm install instead of npm ci for more flexibility
  execSync('npm install', { stdio: 'inherit' });
  console.log('Dependencies installed successfully!');
} catch (error) {
  console.error('Failed to install dependencies:', error.message);
  process.exit(1);
}
