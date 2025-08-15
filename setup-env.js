const { execSync } = require('child_process');

const envVars = [
  { name: 'FIREBASE_API_KEY', value: 'AIzaSyAyaItySsM_khVZGLYwgNXmppib0i73mFI' },
  { name: 'FIREBASE_AUTH_DOMAIN', value: 'donateblood-2bf21.firebaseapp.com' },
  { name: 'FIREBASE_PROJECT_ID', value: 'donateblood-2bf21' },
  { name: 'FIREBASE_STORAGE_BUCKET', value: 'donateblood-2bf21.firebasestorage.app' },
  { name: 'FIREBASE_MESSAGING_SENDER_ID', value: '936471207377' },
  { name: 'FIREBASE_APP_ID', value: '1:936471207377:web:569c2e0704c686909b54f0' },
  { name: 'FIREBASE_MEASUREMENT_ID', value: 'G-JX31HFEZ44' },
  { name: 'GOOGLE_MAPS_API_KEY', value: 'AIzaSyBlB34GJNGbRexESR9zILOTx7s5mcIPhkE' }
];

console.log('Setting up EAS environment variables...');

envVars.forEach(({ name, value }) => {
  try {
    console.log(`Setting ${name}...`);
    execSync(`eas env:create --scope project --name ${name} --value "${value}" --type string --environment production`, { stdio: 'inherit' });
    console.log(`✅ ${name} created successfully`);
  } catch (error) {
    console.log(`❌ Failed to create ${name}: ${error.message}`);
  }
});

console.log('\nEnvironment variables setup complete!');
console.log('\nNext steps:');
console.log('1. Create a .env file in your project root with the same variables');
console.log('2. Try building your app again'); 