// d:\cable\networks\app\supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

// Replace these with your actual values from Step 1
const supabaseUrl = 'https://uttshynjmdlakgjoipqu.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dHNoeW5qbWRsYWtnam9pcHF1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk4NzA1NDMsImV4cCI6MjA4NTQ0NjU0M30.RHlhQ1coqB3KU_Ck3DkLl7esue9SQUKhyk_g0uGA8Sk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
