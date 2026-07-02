console.log('Environment Variables:');
Object.keys(process.env).forEach(key => {
  if (key.toLowerCase().includes('supabase') || key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('pass')) {
    console.log(`${key}: ${process.env[key]}`);
  }
});
