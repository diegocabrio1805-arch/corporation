import fetch from 'node-fetch';

const url = 'https://samgpnczlznynnfhjjff.supabase.co/rest/v1/gps_history';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNhbWdwbmN6bHpueW5uZmhqamZmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjU1NjQsImV4cCI6MjA4Nzc0MTU2NH0.AV1Z-QlltfPp8am-_ALlgopoGB8WhOrle83TNZrjqTE';

fetch(url, {
  method: 'POST',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  },
  body: JSON.stringify({
    collector_id: 'a3b09603-57e2-4838-8043-4e92898b932c',
    collector_name: 'TEST',
    latitude: -25.30066,
    longitude: -57.63591,
    timestamp: new Date().toISOString()
  })
}).then(res => res.text()).then(console.log).catch(console.error);
