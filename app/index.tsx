import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useEffect, useRef, useState } from "react";
import { Alert, Animated, Button, FlatList, Image, Modal, Platform, Pressable, SafeAreaView, ScrollView, Share, StatusBar, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from './supabase';

// Types
interface Customer {
  id: string;
  name: string;
  package: string;
  status: 'paid' | 'unpaid';
  type: 'cable' | 'internet';
  address: string;
  lastRecharge?: string;
  boxNumber?: string;
  macAddress?: string;
  mobile?: string;
  excludeFromReset?: boolean;
}

interface Package {
  id: string;
  name: string;
  price: string;
  type: 'cable' | 'internet';
  features: string;
  active: boolean;
  myProfit?: string;
}

interface Bundle {
  id: string;
  name: string;
  items: string;
}

interface BackupRecord {
  id: string;
  name: string;
  data: string;
  created_at: string;
}

interface CustomerHistory {
  id: string;
  customer_id: string;
  action: string;
  details: string;
  timestamp: string;
}

// Login Component
const LoginScreen = ({ onLogin, onBack }: { onLogin: () => void, onBack: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const savedUsername = await AsyncStorage.getItem('rememberedUsername');
        const savedPassword = await AsyncStorage.getItem('rememberedPassword');
        if (savedUsername && savedPassword) {
          setUsername(savedUsername);
          setPassword(savedPassword);
          setRememberMe(true);
        }
      } catch (error) {
        console.log('Error loading credentials', error);
      }
    };
    loadCredentials();
  }, []);

  const handleLogin = async () => {
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Please enter your username');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Validation Error', 'Please enter your password');
      return;
    }

    if (rememberMe) {
      await AsyncStorage.setItem('rememberedUsername', username);
      await AsyncStorage.setItem('rememberedPassword', password);
    } else {
      await AsyncStorage.removeItem('rememberedUsername');
      await AsyncStorage.removeItem('rememberedPassword');
    }

    onLogin();
  };

  const handleForgotPassword = async () => {
    if (!username.trim()) {
      Alert.alert('Input Required', 'Please enter your email address in the field above to reset your password.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(username);

    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Success', 'Password reset email sent! Check your inbox.');
  };

  return (
    <View style={styles.loginContainer}>
      <View style={styles.loginCard}>
        <Text style={styles.loginTitle}>Admin Login</Text>
        <Text style={styles.loginSubtitle}>Sign in to your account</Text>
        
        <View style={styles.formGroup}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter email"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordContainer}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Enter password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!isPasswordVisible}
            />
            <TouchableOpacity onPress={() => setIsPasswordVisible(!isPasswordVisible)} style={styles.eyeIcon}>
              <Text style={{fontSize: 16}}>{isPasswordVisible ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={styles.rememberMeContainer} onPress={() => setRememberMe(!rememberMe)}>
          <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
            {rememberMe && <Text style={styles.checkboxCheck}>✓</Text>}
          </View>
          <Text style={styles.rememberMeText}>Remember Me</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnPrimary} onPress={handleLogin}>
          <Text style={styles.btnText}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnLink} onPress={handleForgotPassword}>
          <Text style={[styles.linkText, { color: '#6b7280' }]}>Forgot Password?</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.btnLink} onPress={onBack}>
          <Text style={styles.linkText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Admin Panel Component
const AdminPanel = ({ onLogout }: { onLogout: () => void }) => {
  const [activeTab, setActiveTab] = useState<'cable' | 'internet' | 'packages' | 'reports' | 'settings' | 'profile'>('cable');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Form State
  const [newName, setNewName] = useState('');
  const [newPackage, setNewPackage] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newLastRecharge, setNewLastRecharge] = useState('');
  const [newBoxNumber, setNewBoxNumber] = useState('');
  const [newMacAddress, setNewMacAddress] = useState('');
  const [newMobile, setNewMobile] = useState('');
  const [newStatus, setNewStatus] = useState<'paid' | 'unpaid'>('unpaid');
  const [newExcludeFromReset, setNewExcludeFromReset] = useState(false);
  const [newType, setNewType] = useState<'cable' | 'internet'>('cable');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profile, setProfile] = useState({
    name: 'Administrator',
    username: 'admin',
    avatar: null as string | null,
    oldPassword: '',
    password: '',
    confirmPassword: '',
    upiId: ''
  });
  const [currentStoredPassword, setCurrentStoredPassword] = useState('admin');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPackagePicker, setShowPackagePicker] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'boxNumber' | 'address' | 'mobile' | 'package' | 'lastRecharge'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [packageModalVisible, setPackageModalVisible] = useState(false);
  const [pkgName, setPkgName] = useState('');
  const [pkgPrice, setPkgPrice] = useState('');
  const [pkgMyProfit, setPkgMyProfit] = useState('');
  const [pkgType, setPkgType] = useState<'cable' | 'internet'>('cable');
  const [pkgFeatures, setPkgFeatures] = useState('');
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [pkgActive, setPkgActive] = useState(true);
  const [clearDataModalVisible, setClearDataModalVisible] = useState(false);
  const [authPassword, setAuthPassword] = useState('');
  const [packageSearchQuery, setPackageSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'detail'>('detail');
  const [showViewOptions, setShowViewOptions] = useState(false);
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [deletedCustomers, setDeletedCustomers] = useState<Customer[]>([]);
  const [recycleBinModalVisible, setRecycleBinModalVisible] = useState(false);
  const [recycleBinSearchQuery, setRecycleBinSearchQuery] = useState('');
  const [reportStartDate, setReportStartDate] = useState('');
  const [reportEndDate, setReportEndDate] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [activePackageSubTab, setActivePackageSubTab] = useState<'packages' | 'bundles'>('packages');
  const [bundleModalVisible, setBundleModalVisible] = useState(false);
  const [newBundleName, setNewBundleName] = useState('');
  const [newBundleItems, setNewBundleItems] = useState<string[]>([]);
  const [pickerMode, setPickerMode] = useState<'packages' | 'bundles'>('packages');
  const [packagePickerSearchQuery, setPackagePickerSearchQuery] = useState('');
  const [packageFilter, setPackageFilter] = useState('');
  const [editingBundleId, setEditingBundleId] = useState<string | null>(null);
  const [restoreModalVisible, setRestoreModalVisible] = useState(false);
  const [restoreDataString, setRestoreDataString] = useState('');
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [cloudBackupModalVisible, setCloudBackupModalVisible] = useState(false);
  const [newBackupName, setNewBackupName] = useState('');
  const [backupSearchQuery, setBackupSearchQuery] = useState('');
  const [backupScope, setBackupScope] = useState<'all' | 'cable' | 'internet'>('all');
  const [fabOpen, setFabOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fabAnim = useRef(new Animated.Value(0)).current;
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<CustomerHistory[]>([]);
  const [historyCustomerName, setHistoryCustomerName] = useState('');
  const [commonDueDay, setCommonDueDay] = useState('1');
  const [lastResetDate, setLastResetDate] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [resetHistoryModalVisible, setResetHistoryModalVisible] = useState(false);
  const [resetHistory, setResetHistory] = useState<any[]>([]);
  const [autoResetEnabled, setAutoResetEnabled] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'paid' | 'unpaid'>('all');
  const [reportTypeFilter, setReportTypeFilter] = useState<'all' | 'cable' | 'internet'>('all');

  useEffect(() => {
    Animated.spring(fabAnim, {
      toValue: fabOpen ? 1 : 0,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [fabOpen]);

  // Fetch Data from Supabase
  const fetchCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('deleted', false); // Only fetch active customers

    if (error) {
      Alert.alert('Error fetching customers', error.message);
    } else if (data) {
      // Map snake_case DB columns to camelCase TS interface
      const mappedCustomers: Customer[] = data.map((c: any) => ({
        ...c,
        lastRecharge: c.last_recharge,
        boxNumber: c.box_number,
        macAddress: c.mac_address,
        excludeFromReset: c.exclude_from_reset
      }));
      setCustomers(mappedCustomers);
    }
  };

  const fetchPackages = async () => {
    const { data, error } = await supabase.from('packages').select('*');
    if (error) {
      Alert.alert('Error fetching packages', error.message);
    } else if (data) {
      const mappedPackages = data.map((p: any) => ({
        ...p,
        myProfit: p.my_profit
      }));
      setPackages(mappedPackages as Package[]);
    }
  };

  const fetchBundles = async () => {
    const { data, error } = await supabase.from('bundles').select('*');
    if (data) {
        setBundles(data as Bundle[]);
    }
    // Ignore error if table doesn't exist yet, we'll handle it on save
  };

  const fetchDeletedCustomers = async () => {
    const { data } = await supabase.from('customers').select('*').eq('deleted', true);
    if (data) {
       // Map snake_case DB columns to camelCase TS interface
       const mapped: Customer[] = data.map((c: any) => ({
        ...c,
        lastRecharge: c.last_recharge,
        boxNumber: c.box_number,
        macAddress: c.mac_address
      }));
      setDeletedCustomers(mapped);
    }
  };

  const fetchBackups = async () => {
    const { data, error } = await supabase.from('backups').select('*').order('created_at', { ascending: false });
    if (data) {
        setBackups(data as BackupRecord[]);
    }
    if (error) {
        console.log('Error fetching backups:', error.message);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchPackages();
    fetchDeletedCustomers();
    fetchBundles();
    fetchBackups();
  }, []);

  useEffect(() => {
    const loadSettings = async () => {
        try {
            const day = await AsyncStorage.getItem('commonDueDay');
            const last = await AsyncStorage.getItem('lastResetDate');
            const auto = await AsyncStorage.getItem('autoResetEnabled');
            const savedUpi = await AsyncStorage.getItem('upiId');
            if (day) setCommonDueDay(day);
            if (last) setLastResetDate(last);
            if (auto) setAutoResetEnabled(JSON.parse(auto));
            if (savedUpi) setProfile(prev => ({ ...prev, upiId: savedUpi }));
        } catch (e) {
            console.log('Error loading settings', e);
        }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    const checkMonthlyReset = () => {
        const dueDay = parseInt(commonDueDay);
        const today = new Date();
        const currentDay = today.getDate();
        
        if (currentDay >= dueDay) {
            const currentMonthKey = `${today.getFullYear()}-${today.getMonth()}`;
            const lastResetMonthKey = lastResetDate ? `${new Date(lastResetDate).getFullYear()}-${new Date(lastResetDate).getMonth()}` : '';
            
            if (currentMonthKey !== lastResetMonthKey) {
                if (autoResetEnabled) {
                    performMonthlyReset(true);
                } else {
                    Alert.alert(
                        "Monthly Billing Cycle",
                        `It is past the common recharge day (${dueDay}). Do you want to reset all 'Paid' customers to 'Unpaid'?`,
                        [
                            { text: "Later", style: "cancel" },
                            { text: "Reset Now", onPress: handleMonthlyReset }
                        ]
                    );
                }
            }
        }
    };

    // Check on mount/update
    checkMonthlyReset();

    // Loop check every hour
    const interval = setInterval(checkMonthlyReset, 3600000);
    return () => clearInterval(interval);
  }, [commonDueDay, lastResetDate, autoResetEnabled]);

  const handleRefresh = async () => {
    await Promise.all([
        fetchCustomers(),
        fetchPackages(),
        fetchDeletedCustomers(),
        fetchBundles(),
        fetchBackups()
    ]);
    Alert.alert('Refreshed', 'Data has been reloaded successfully.');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
        fetchCustomers(),
        fetchPackages(),
        fetchDeletedCustomers(),
        fetchBundles(),
        fetchBackups()
    ]);
    setRefreshing(false);
  };

  useEffect(() => {
    setPackageFilter('');
  }, [activeTab]);

  const filteredCustomers = customers.filter(c => 
    c.type === activeTab && 
    (statusFilter === 'all' || c.status === statusFilter) &&
    (!packageFilter || c.package.toLowerCase().includes(packageFilter.toLowerCase())) &&
    (c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     c.package.toLowerCase().includes(searchQuery.toLowerCase()) ||
     c.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
     (c.mobile && c.mobile.includes(searchQuery)) ||
     (c.boxNumber && c.boxNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
     (c.macAddress && c.macAddress.toLowerCase().includes(searchQuery.toLowerCase())))
  ).sort((a, b) => {
    let valA = '';
    let valB = '';
    
    switch(sortBy) {
        case 'name': valA = a.name; valB = b.name; break;
        case 'boxNumber': valA = a.boxNumber || ''; valB = b.boxNumber || ''; break;
        case 'address': valA = a.address; valB = b.address; break;
        case 'mobile': valA = a.mobile || ''; valB = b.mobile || ''; break;
        case 'package': valA = a.package; valB = b.package; break;
        case 'lastRecharge': valA = a.lastRecharge || ''; valB = b.lastRecharge || ''; break;
        default: valA = a.name; valB = b.name;
    }
    
    return sortOrder === 'asc' 
      ? valA.localeCompare(valB) 
      : valB.localeCompare(valA);
  });

  const overdueCustomers = customers.filter(c => c.status === 'unpaid');

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled) {
      setProfile(prev => ({ ...prev, avatar: result.assets[0].uri }));
    }
  };

  const logCustomerAction = async (customerId: string, action: string, details: string) => {
      const { error } = await supabase.from('customer_history').insert([{
          customer_id: customerId,
          action,
          details,
          timestamp: new Date().toISOString()
      }]);

      if (error) {
          if (error.message.includes('relation "public.customer_history" does not exist') || error.message.includes('could not find the table')) {
               Alert.alert('Database Update Required', 'Please run this SQL in Supabase: create table customer_history (id uuid default gen_random_uuid() primary key, customer_id uuid references customers(id) on delete cascade, action text, details text, timestamp timestamp with time zone default now());');
          } else {
              console.log('Error logging action:', error.message);
          }
      }
  };

  const fetchCustomerHistory = async (customerId: string) => {
      const { data, error } = await supabase
        .from('customer_history')
        .select('*')
        .eq('customer_id', customerId)
        .order('timestamp', { ascending: false });
      
      if (error) {
          if (error.message.includes('relation "public.customer_history" does not exist') || error.message.includes('could not find the table')) {
               Alert.alert('Database Update Required', 'Please run this SQL in Supabase: create table customer_history (id uuid default gen_random_uuid() primary key, customer_id uuid references customers(id) on delete cascade, action text, details text, timestamp timestamp with time zone default now());');
          }
      }
      
      if (data) {
          setCustomerHistory(data as CustomerHistory[]);
      }
  };

  const handleSaveCustomer = async () => {
    if (!newName.trim() || !newPackage.trim() || !newAddress.trim()) {
      Alert.alert('Validation Error', 'All fields are required.');
      return;
    }

    if (newName.trim().length < 3) {
      Alert.alert('Validation Error', 'Name must be at least 3 characters long.');
      return;
    }

    if (newAddress.trim().length < 5) {
      Alert.alert('Validation Error', 'Address must be at least 5 characters long.');
      return;
    }

    if (newMobile.trim() && !/^\d{10}$/.test(newMobile.trim())) {
      Alert.alert('Validation Error', 'Mobile number must be exactly 10 digits.');
      return;
    }

    const customerData = {
      name: newName,
      package: newPackage,
      status: newStatus,
      type: newType,
      address: newAddress,
      last_recharge: newLastRecharge || new Date().toISOString().split('T')[0],
      box_number: newType === 'cable' ? newBoxNumber : null,
      mac_address: newType === 'internet' ? newMacAddress : null,
      mobile: newMobile,
      exclude_from_reset: newExcludeFromReset
    };

    if (editingId) {
      const { error } = await supabase
        .from('customers')
        .update(customerData)
        .eq('id', editingId);
      
      if (error) {
          if (error.message.includes('exclude_from_reset')) {
              Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE customers ADD COLUMN exclude_from_reset boolean DEFAULT false;');
          } else {
              Alert.alert('Error', error.message);
          }
      } else {
          await logCustomerAction(editingId, 'Updated', 'Customer details updated');
          fetchCustomers();
      }
    } else {
      const { data, error } = await supabase
        .from('customers')
        .insert([customerData])
        .select();

      if (error) {
          if (error.message.includes('exclude_from_reset')) {
              Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE customers ADD COLUMN exclude_from_reset boolean DEFAULT false;');
          } else {
              Alert.alert('Error', error.message);
          }
      } else {
          if (data) await logCustomerAction(data[0].id, 'Created', `Customer ${newName} created`);
          fetchCustomers();
      }
    }

    setNewName('');
    setNewPackage('');
    setNewAddress('');
    setNewLastRecharge('');
    setNewBoxNumber('');
    setNewMacAddress('');
    setNewMobile('');
    setNewStatus('unpaid');
    setNewExcludeFromReset(false);
    setEditingId(null);
    setModalVisible(false);
  };

  const handleSavePackage = async () => {
    if (!pkgName.trim() || !pkgPrice.trim() || !pkgFeatures.trim()) {
      Alert.alert('Validation Error', 'All fields are required.');
      return;
    }

    const pkgData = {
      name: pkgName,
      price: pkgPrice.startsWith('₹') ? pkgPrice : `₹${pkgPrice}`,
      type: pkgType,
      features: pkgFeatures,
      active: pkgActive,
      my_profit: pkgMyProfit ? (pkgMyProfit.startsWith('₹') ? pkgMyProfit : `₹${pkgMyProfit}`) : null
    };

    if (editingPackageId) {
      const { error } = await supabase
        .from('packages')
        .update(pkgData)
        .eq('id', editingPackageId);
      if (error) {
        if (error.message.includes('my_profit')) {
            Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE packages ADD COLUMN my_profit text;');
        } else {
            Alert.alert('Error', error.message);
        }
      }
      else fetchPackages();
    } else {
      const { error } = await supabase
        .from('packages')
        .insert([pkgData]);
      if (error) {
        if (error.message.includes('my_profit')) {
            Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE packages ADD COLUMN my_profit text;');
        } else {
            Alert.alert('Error', error.message);
        }
      }
      else fetchPackages();
    }

    setPkgName('');
    setPkgPrice('');
    setPkgMyProfit('');
    setPkgFeatures('');
    setPkgActive(true);
    setEditingPackageId(null);
    setPackageModalVisible(false);
  };

  const handleSaveBundle = async () => {
    if (!newBundleName.trim() || newBundleItems.length === 0) {
        Alert.alert('Validation Error', 'Please provide a name and select at least one package.');
        return;
    }

    const bundleData = {
        name: newBundleName,
        items: newBundleItems.join(', ')
    };

    if (editingBundleId) {
        const { error } = await supabase
            .from('bundles')
            .update(bundleData)
            .eq('id', editingBundleId);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            fetchBundles();
            setBundleModalVisible(false);
            setNewBundleName('');
            setNewBundleItems([]);
            setEditingBundleId(null);
        }
    } else {
        const { error } = await supabase.from('bundles').insert([bundleData]);
        
        if (error) {
            if (error.message.includes('relation "public.bundles" does not exist') || error.message.includes('could not find the table')) {
                Alert.alert('Database Update Required', 'Please run this SQL in Supabase: create table bundles (id uuid default gen_random_uuid() primary key, name text, items text);');
            } else {
                Alert.alert('Error', error.message);
            }
        } else {
            fetchBundles();
            setBundleModalVisible(false);
            setNewBundleName('');
            setNewBundleItems([]);
        }
    }
  };

  const handleDeleteBundle = async (id: string) => {
      await supabase.from('bundles').delete().eq('id', id);
      fetchBundles();
  };

  const handleEditBundle = (bundle: Bundle) => {
      setNewBundleName(bundle.name);
      setNewBundleItems(bundle.items.split(',').map(s => s.trim()));
      setEditingBundleId(bundle.id);
      setBundleModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (profile.password) {
      if (profile.oldPassword !== currentStoredPassword) {
        Alert.alert('Error', 'Old password is incorrect');
        return;
      }
      if (profile.password !== profile.confirmPassword) {
        Alert.alert('Error', 'New passwords do not match');
        return;
      }
      setCurrentStoredPassword(profile.password);
    }
    await AsyncStorage.setItem('upiId', profile.upiId || '');
    Alert.alert('Success', 'Profile updated successfully');
    setProfile(prev => ({ ...prev, oldPassword: '', password: '', confirmPassword: '' }));
  };

  const handleEditPackage = (pkg: Package) => {
    setPkgName(pkg.name);
    setPkgPrice(pkg.price.replace('₹', ''));
    setPkgMyProfit(pkg.myProfit ? pkg.myProfit.replace('₹', '') : '');
    setPkgFeatures(pkg.features);
    setPkgType(pkg.type);
    setPkgActive(pkg.active);
    setEditingPackageId(pkg.id);
    setPackageModalVisible(true);
  };

  const handleViewHistory = (customer: Customer) => {
      setHistoryCustomerName(customer.name);
      fetchCustomerHistory(customer.id);
      setHistoryModalVisible(true);
  };

  const handleDeletePackage = async (id: string) => {
    Alert.alert(
      "Delete Package",
      "Are you sure you want to delete this package?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            await supabase.from('packages').delete().eq('id', id);
            fetchPackages();
          }
        }
      ]
    );
  };

  const handleEditCustomer = (customer: Customer) => {
    setNewName(customer.name);
    setNewPackage(customer.package);
    setNewAddress(customer.address);
    setNewLastRecharge(customer.lastRecharge || '');
    setNewBoxNumber(customer.boxNumber || '');
    setNewMacAddress(customer.macAddress || '');
    setNewMobile(customer.mobile || '');
    setNewStatus(customer.status);
    setNewExcludeFromReset(customer.excludeFromReset || false);
    setNewType(customer.type);
    setEditingId(customer.id);
    setModalVisible(true);
  };

  const handleDeleteCustomer = async (id: string) => {
    Alert.alert(
      "Delete Customer",
      "Are you sure you want to delete this customer? They will be moved to the Recycle Bin.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            // Soft delete: Update 'deleted' flag to true
            await supabase.from('customers').update({ deleted: true }).eq('id', id);
            await logCustomerAction(id, 'Deleted', 'Moved to Recycle Bin');
            fetchCustomers();
            fetchDeletedCustomers();
          }
        }
      ]
    );
  };

  const handleRestoreCustomer = async (id: string) => {
    await supabase.from('customers').update({ deleted: false }).eq('id', id);
    await logCustomerAction(id, 'Restored', 'Restored from Recycle Bin');
    fetchCustomers();
    fetchDeletedCustomers();
  };

  const handlePermanentDelete = async (id: string) => {
    Alert.alert(
        "Permanent Delete",
        "Are you sure? This cannot be undone.",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive", 
                onPress: async () => {
                    await supabase.from('customers').delete().eq('id', id);
                    fetchDeletedCustomers();
                }
            }
        ]
    );
  };

  const handleEmptyRecycleBin = async () => {
      Alert.alert(
        "Empty Recycle Bin",
        "Are you sure you want to permanently delete all items?",
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Empty", 
                style: "destructive", 
                onPress: async () => {
                    await supabase.from('customers').delete().eq('deleted', true);
                    fetchDeletedCustomers();
                }
            }
        ]
    );
  };

  const handleShareInvoice = async (customer: Customer) => {
    const pkgNames = customer.package.split(',').map(s => s.trim()).filter(s => s);
    let totalPrice = 0;
    
    // CUSTOMIZE BRAND COLORS HERE
    const brandColor = '#2563eb'; // Main brand color (currently Blue)

    // QR Code Data
    const upiId = profile.upiId;
    const qrCodeUrl = upiId ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(`upi://pay?pa=${upiId}&pn=Swathi%20Networks&am=${totalPrice.toFixed(2)}&cu=INR`)}` : null;

    const packageItems = pkgNames.map(name => {
        const pkg = packages.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
        const priceVal = pkg ? (parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0) : 0;
        totalPrice += priceVal;
        return { name, price: priceVal };
    });

    const packageRows = packageItems.map(item => `
      <tr>
        <td>
          <div style="font-weight: bold;">${item.name}</div>
          <div style="font-size: 12px; color: #666;">${customer.type === 'cable' ? 'Cable TV Service' : 'Internet Service'}</div>
        </td>
        <td style="text-align: right;">₹${item.price.toFixed(2)}</td>
      </tr>
    `).join('');

    const html = `
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #f3f4f6; padding-bottom: 20px; }
            .company-info { text-align: right; }
            .company-name { font-size: 24px; font-weight: bold; color: ${brandColor}; margin-bottom: 5px; }
            .invoice-title { font-size: 32px; font-weight: bold; color: #111827; letter-spacing: -1px; }
            .section { margin-bottom: 40px; }
            .row { display: flex; justify-content: space-between; }
            .col { flex: 1; }
            .label { font-weight: 600; color: #6b7280; font-size: 11px; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
            .value { font-size: 15px; line-height: 1.5; color: #1f2937; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { text-align: left; padding: 12px 0; border-bottom: 2px solid ${brandColor}; color: #4b5563; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            td { padding: 16px 0; border-bottom: 1px solid #f3f4f6; color: #1f2937; }
            .total-section { margin-top: 30px; display: flex; justify-content: flex-end; }
            .total-box { width: 250px; }
            .total-row { display: flex; justify-content: space-between; padding: 8px 0; color: #4b5563; }
            .grand-total { font-size: 18px; font-weight: bold; border-top: 2px solid ${brandColor}; padding-top: 15px; margin-top: 10px; color: #111827; }
            .footer { margin-top: 80px; text-align: center; color: #9ca3af; font-size: 12px; border-top: 1px solid #f3f4f6; padding-top: 30px; }
            .status-badge { display: inline-block; padding: 6px 12px; border-radius: 9999px; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
            .paid { background-color: #d1fae5; color: #065f46; }
            .unpaid { background-color: #fee2e2; color: #991b1b; }
            .logo { width: 40px; height: 40px; border-radius: 8px; margin-bottom: 10px; object-fit: cover; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="invoice-title">INVOICE</div>
              <div style="margin-top: 8px; color: #6b7280; font-size: 14px;">#INV-${customer.id.substring(0, 8).toUpperCase()}</div>
              <div style="color: #6b7280; font-size: 14px;">Date: ${new Date().toLocaleDateString()}</div>
            </div>
            <div class="company-info">
              ${profile.avatar ? `<img src="${profile.avatar}" class="logo" />` : ''}
              <div class="company-name">Swathi Networks</div>
              <div style="color: #6b7280; font-size: 13px;">Digital Cable & Internet Services</div>
              <div style="color: #6b7280; font-size: 13px;">support@swathinetworks.com</div>
            </div>
          </div>

          <div class="section row">
            <div class="col">
              <div class="label">Bill To</div>
              <div class="value">
                <strong style="font-size: 16px;">${customer.name}</strong><br>
                ${customer.address}<br>
                ${customer.mobile ? `Mobile: ${customer.mobile}` : ''}
              </div>
            </div>
            <div class="col" style="text-align: right;">
              <div class="label">Service Details</div>
              <div class="value">
                Type: ${customer.type.charAt(0).toUpperCase() + customer.type.slice(1)}<br>
                ${customer.type === 'cable' ? `Box No: ${customer.boxNumber || 'N/A'}` : `MAC: ${customer.macAddress || 'N/A'}`}<br>
                <div style="margin-top: 10px;">
                  <span class="status-badge ${customer.status}">${customer.status}</span>
                </div>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 70%">Description</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${packageRows}
            </tbody>
          </table>

          <div class="row" style="margin-top: 30px;">
            <div class="col">
                ${qrCodeUrl ? `
                <div style="font-weight: bold; margin-bottom: 10px; font-size: 12px;">Scan to Pay</div>
                <img src="${qrCodeUrl}" style="width: 100px; height: 100px; border: 1px solid #eee; padding: 5px;" />
                <div style="font-size: 10px; color: #666; margin-top: 5px;">UPI ID: ${upiId}</div>
                ` : ''}
            </div>
            <div class="col total-section">
                <div class="total-box">
                  <div class="total-row">
                    <span>Subtotal</span>
                    <span>₹${totalPrice.toFixed(2)}</span>
                  </div>
                  <div class="total-row">
                    <span>Tax (0%)</span>
                    <span>₹0.00</span>
                  </div>
                  <div class="total-row grand-total">
                    <span>Total Due</span>
                    <span>₹${totalPrice.toFixed(2)}</span>
                  </div>
                </div>
            </div>
          </div>

          <div class="footer">
            <p>Thank you for choosing Swathi Networks!</p>
            <p>This is a computer-generated invoice and does not require a signature.</p>
          </div>
        </body>
      </html>
    `;

    try {
      if (Platform.OS === 'web') {
        await Print.printAsync({ html });
      } else {
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
      }
      await logCustomerAction(customer.id, 'Invoice Generated', 'PDF Invoice generated and shared');
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  const handleClearData = () => {
    setAuthPassword('');
    setClearDataModalVisible(true);
  };

  const confirmClearData = () => {
    if (authPassword !== currentStoredPassword) {
      Alert.alert('Authentication Failed', 'Incorrect password. Data was not cleared.');
      return;
    }
    // Delete all customers
    supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000').then(() => {
        fetchCustomers();
    });
    setClearDataModalVisible(false);
    Alert.alert("Success", "All data has been cleared.");
  };

  const handleBulkReminders = async () => {
    if (overdueCustomers.length === 0) {
        Alert.alert("Info", "No overdue customers found.");
        return;
    }

    const reminders = overdueCustomers.map(c => {
        const pkgNames = c.package.split(',').map(s => s.trim());
        let total = 0;
        pkgNames.forEach(name => {
            const pkg = packages.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
            if (pkg) total += (parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0);
        });
        return `${c.name} (${c.mobile || 'No Mobile'}) - ₹${total.toFixed(2)}`;
    }).join('\n');

    const message = `⚠️ Overdue Payment List ⚠️\n\n${reminders}\n\nTotal Pending: ${overdueCustomers.length}`;

    try {
        await Share.share({ message, title: 'Overdue Reminders' });
    } catch (error: any) {
        Alert.alert('Error', error.message);
    }
  };

  const handleSaveCloudBackup = async () => {
      if (!newBackupName.trim()) {
          Alert.alert('Validation Error', 'Please enter a name for the backup.');
          return;
      }

      try {
        let customerQuery = supabase.from('customers').select('*');
        let packageQuery = supabase.from('packages').select('*');

        if (backupScope !== 'all') {
            customerQuery = customerQuery.eq('type', backupScope);
            packageQuery = packageQuery.eq('type', backupScope);
        }

        const { data: customers } = await customerQuery;
        const { data: packages } = await packageQuery;
        const { data: bundles } = await supabase.from('bundles').select('*');

        const backupData = JSON.stringify({
            version: 1,
            type: backupScope,
            timestamp: new Date().toISOString(),
            customers: customers || [],
            packages: packages || [],
            bundles: bundles || []
        });

        const { error } = await supabase.from('backups').insert([{
            name: newBackupName,
            data: backupData
        }]);

        if (error) {
            if (error.message.includes('relation "public.backups" does not exist') || error.message.includes('could not find the table')) {
                Alert.alert('Database Update Required', 'Please run this SQL in Supabase: create table backups (id uuid default gen_random_uuid() primary key, name text, data text, created_at timestamp with time zone default now());');
            } else {
                Alert.alert('Error', error.message);
            }
        } else {
            Alert.alert('Success', 'Backup saved to database.');
            setCloudBackupModalVisible(false);
            setNewBackupName('');
            fetchBackups();
        }
      } catch (error: any) {
          Alert.alert('Error', error.message);
      }
  };

  const handleDeleteBackup = async (id: string) => {
      Alert.alert(
          "Delete Backup",
          "Are you sure you want to delete this backup?",
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Delete", 
                  style: "destructive", 
                  onPress: async () => {
                      const { error } = await supabase.from('backups').delete().eq('id', id);
                      if (error) Alert.alert('Error', error.message);
                      else fetchBackups();
                  }
              }
          ]
      );
  };

  const handleDownloadBackupCSV = async (backup: BackupRecord) => {
    try {
      const data = JSON.parse(backup.data);
      const customersList = data.customers || [];
      
      if (customersList.length === 0) {
          Alert.alert('Info', 'No customers in this backup.');
          return;
      }

      const header = "ID,Name,Type,Package,Status,Address,Mobile,Last Recharge,Box Number,MAC Address\n";
      const rows = customersList.map((c: any) => 
        `${c.id},"${c.name}",${c.type},"${c.package}",${c.status},"${c.address}",${c.mobile || ''},${c.lastRecharge || ''},${c.boxNumber || ''},${c.macAddress || ''}`
      ).join("\n");
      
      const csv = header + rows;
      const fileName = `${backup.name.replace(/[^a-zA-Z0-9]/g, '_')}_Export.csv`;
      
      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        return;
      }

      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
      } else {
          Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleRestoreCloudBackup = (backup: BackupRecord) => {
      Alert.alert(
          "Confirm Restore",
          `Are you sure you want to restore "${backup.name}"? This will replace all current data.`,
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Restore", 
                  style: "destructive", 
                  onPress: () => {
                      try {
                          const data = JSON.parse(backup.data);
                          executeRestore(data, true);
                      } catch (e) {
                          Alert.alert('Error', 'Failed to parse backup data.');
                      }
                  }
              }
          ]
      );
  };

  const handleBackupDatabase = async (type: 'all' | 'cable' | 'internet' = 'all') => {
    try {
        let customerQuery = supabase.from('customers').select('*');
        let packageQuery = supabase.from('packages').select('*');

        if (type !== 'all') {
            customerQuery = customerQuery.eq('type', type);
            packageQuery = packageQuery.eq('type', type);
        }

        const { data: customers } = await customerQuery;
        const { data: packages } = await packageQuery;
        const { data: bundles } = await supabase.from('bundles').select('*');

        // Generate CSV for Customers
        const header = "id,name,package,status,type,address,lastRecharge,boxNumber,macAddress,mobile";
        const rows = (customers || []).map((c: any) => 
            `"${c.id}","${c.name}","${c.package}","${c.status}","${c.type}","${c.address}","${c.last_recharge || ''}","${c.box_number || ''}","${c.mac_address || ''}","${c.mobile || ''}"`
        ).join("\n");
        const csvContent = `${header}\n${rows}`;

        const fileName = `Swathi_Networks_Backup_${type}_${new Date().toISOString().split('T')[0]}.csv`;
        
        if (Platform.OS === 'web') {
          const blob = new Blob([csvContent], { type: 'text/csv' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = fileName;
          link.click();
          return;
        }

        const fileUri = FileSystem.documentDirectory + fileName;
        await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });

        if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(fileUri);
        } else {
            Alert.alert('Error', 'Sharing is not available on this device');
        }
    } catch (error: any) {
        Alert.alert('Backup Error', error.message);
    }
  };

  const handleSaveCommonDueDay = async () => {
    const day = parseInt(commonDueDay);
    if (isNaN(day) || day < 1 || day > 28) {
        Alert.alert("Invalid Day", "Please enter a day between 1 and 28.");
        return;
    }
    await AsyncStorage.setItem('commonDueDay', commonDueDay);
    Alert.alert("Success", "Common due day saved.");
  };

  const performMonthlyReset = async (silent = false) => {
    // 1. Get paid customers
    const { data: paidCustomers, error: fetchError } = await supabase.from('customers')
        .select('*')
        .eq('status', 'paid')
        .eq('deleted', false)
        .not('exclude_from_reset', 'eq', true);
    
    if (fetchError) {
        if (fetchError.message.includes('exclude_from_reset')) {
            if (!silent) Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE customers ADD COLUMN exclude_from_reset boolean DEFAULT false;');
        } else {
            if (!silent) Alert.alert("Error fetching customers", fetchError.message);
        }
        return;
    }
    
    if (!paidCustomers || paidCustomers.length === 0) {
        if (!silent) Alert.alert("Info", "No paid customers to reset.");
        // Still update last reset date to avoid nagging
        const today = new Date().toISOString().split('T')[0];
        setLastResetDate(today);
        await AsyncStorage.setItem('lastResetDate', today);
        return;
    }

    // 2. Update to unpaid
    const { error: updateError } = await supabase.from('customers')
        .update({ status: 'unpaid' })
        .eq('status', 'paid')
        .eq('deleted', false)
        .not('exclude_from_reset', 'eq', true);
    
    if (updateError) {
        if (updateError.message.includes('exclude_from_reset')) {
            if (!silent) Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE customers ADD COLUMN exclude_from_reset boolean DEFAULT false;');
        } else {
            if (!silent) Alert.alert("Error", updateError.message);
        }
        return;
    }

    // 3. Log history
    const historyEntries = paidCustomers.map(c => ({
        customer_id: c.id,
        action: 'Monthly Reset',
        details: `Status changed to Unpaid (Cycle Day: ${commonDueDay})${silent ? ' [Auto]' : ''}`,
        timestamp: new Date().toISOString()
    }));
    
    const { error: historyError } = await supabase.from('customer_history').insert(historyEntries);
    if (historyError) {
        if (historyError.message.includes('relation "public.customer_history" does not exist') || historyError.message.includes('could not find the table')) {
            if (!silent) Alert.alert('Database Update Required', 'Please run this SQL in Supabase: create table customer_history (id uuid default gen_random_uuid() primary key, customer_id uuid references customers(id) on delete cascade, action text, details text, timestamp timestamp with time zone default now());');
        }
    }

    // 4. Update local state
    const today = new Date().toISOString().split('T')[0];
    setLastResetDate(today);
    await AsyncStorage.setItem('lastResetDate', today);
    
    fetchCustomers();
    if (!silent) {
        Alert.alert("Success", `Reset complete. ${paidCustomers.length} customers marked as Unpaid.`);
    } else {
        Alert.alert("Auto Reset", `Monthly billing cycle reset complete. ${paidCustomers.length} customers marked as Unpaid.`);
    }
  };

  const handleMonthlyReset = async () => {
    Alert.alert(
        "Confirm Monthly Reset",
        `This will mark ALL 'Paid' customers as 'Unpaid' and log it in history.\n\nConfigured Cycle Day: ${commonDueDay}\n\nContinue?`,
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Proceed", 
                style: "destructive", 
                onPress: () => performMonthlyReset(false)
            }
        ]
    );
  };

  const handleViewResetHistory = async () => {
      const { data, error } = await supabase
          .from('customer_history')
          .select('*, customers(name)')
          .eq('action', 'Monthly Reset')
          .order('timestamp', { ascending: false })
          .limit(300);
      
      if (error) {
          if (error.message.includes('relation "public.customer_history" does not exist') || error.message.includes('could not find the table')) {
              Alert.alert('Database Update Required', 'Please run this SQL in Supabase: create table customer_history (id uuid default gen_random_uuid() primary key, customer_id uuid references customers(id) on delete cascade, action text, details text, timestamp timestamp with time zone default now());');
          } else {
              Alert.alert('Error', error.message);
          }
      } else if (data) {
          setResetHistory(data);
          setResetHistoryModalVisible(true);
      }
  };

  const handleBulkUpdateExclude = async (exclude: boolean) => {
      if (selectedCustomerIds.length === 0) return;

      Alert.alert(
          "Confirm Bulk Update",
          `Set 'Exclude from Reset' to ${exclude ? 'True' : 'False'} for ${selectedCustomerIds.length} customers?`,
          [
              { text: "Cancel", style: "cancel" },
              { 
                  text: "Update", 
                  onPress: async () => {
                      const { error } = await supabase
                          .from('customers')
                          .update({ exclude_from_reset: exclude })
                          .in('id', selectedCustomerIds);
                      
                      if (error) {
                          if (error.message.includes('exclude_from_reset')) {
                              Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE customers ADD COLUMN exclude_from_reset boolean DEFAULT false;');
                          } else {
                              Alert.alert("Error", error.message);
                          }
                      } else {
                          fetchCustomers();
                          setIsSelectionMode(false);
                          setSelectedCustomerIds([]);
                          Alert.alert("Success", "Bulk update complete.");
                      }
                  }
              }
          ]
      );
  };

  const handleLongPress = (id: string) => {
    setIsSelectionMode(true);
    setSelectedCustomerIds([id]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleSelection = (id: string) => {
    if (selectedCustomerIds.includes(id)) {
      const newIds = selectedCustomerIds.filter(i => i !== id);
      setSelectedCustomerIds(newIds);
      if (newIds.length === 0) setIsSelectionMode(false);
    } else {
      setSelectedCustomerIds([...selectedCustomerIds, id]);
    }
  };

  const executeRestore = async (backup: any, confirmed: boolean = false) => {
        // If it's a CSV restore (only customers), backup.packages might be undefined.
        // We validate based on what's present.
        if (!backup.customers && !backup.packages) {
            Alert.alert('Invalid Backup', 'No data found to restore.');
            return;
        }

        const runRestore = async () => {
            try {
                const type = backup.type || 'all';

                // Only delete and restore tables that are present in the backup object
                
                if (backup.customers !== undefined) {
                    if (type === 'all') await supabase.from('customers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    else await supabase.from('customers').delete().eq('type', type);
                    
                    if (backup.customers.length > 0) await supabase.from('customers').upsert(backup.customers);
                }

                if (backup.packages !== undefined) {
                    if (type === 'all') await supabase.from('packages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                    else await supabase.from('packages').delete().eq('type', type);

                    if (backup.packages.length > 0) await supabase.from('packages').upsert(backup.packages);
                }

                if (backup.bundles !== undefined && type === 'all') {
                     await supabase.from('bundles').delete().neq('id', '00000000-0000-0000-0000-000000000000');
                     if (backup.bundles.length > 0) await supabase.from('bundles').upsert(backup.bundles);
                }

                Alert.alert('Success', 'Database restored successfully.');
                setRestoreModalVisible(false);
                setRestoreDataString('');
                setCloudBackupModalVisible(false);
                fetchCustomers();
                fetchPackages();
                fetchBundles();
            } catch (err: any) {
                Alert.alert('Restore Failed', err.message);
            }
        };

        if (confirmed) {
            runRestore();
        } else {
            Alert.alert(
                'Confirm Restore',
                'WARNING: This will DELETE ALL current data and replace it with the backup. This action cannot be undone.',
                [
                    { text: 'Cancel', style: 'cancel' },
                    { 
                        text: 'Restore Data', 
                        style: 'destructive', 
                        onPress: runRestore
                    }
                ]
            );
        }
  };

  const performRestore = async () => {
    const dataStr = restoreDataString.trim();
    if (!dataStr) {
        Alert.alert('Error', 'Please paste the backup data.');
        return;
    }

    try {
        // Try parsing as JSON first (for backward compatibility or cloud backups)
        if (dataStr.startsWith('{')) {
            const backup = JSON.parse(dataStr);
            executeRestore(backup);
        } else {
            // Assume CSV
            const lines = dataStr.split('\n');
            if (lines.length < 2) {
                throw new Error('Invalid CSV format: Not enough lines');
            }
            
            // Simple CSV parser handling quotes
            const parseLine = (line: string) => {
                const result = [];
                let current = '';
                let inQuotes = false;
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    if (char === '"') { inQuotes = !inQuotes; }
                    else if (char === ',' && !inQuotes) { result.push(current); current = ''; }
                    else { current += char; }
                }
                result.push(current);
                return result;
            };

            // Skip header, parse rows
            const customers = lines.slice(1).filter(l => l.trim()).map(line => {
                const cols = parseLine(line);
                // Map CSV columns back to DB structure
                // Header: id,name,package,status,type,address,lastRecharge,boxNumber,macAddress,mobile
                return {
                    id: cols[0],
                    name: cols[1],
                    package: cols[2],
                    status: cols[3],
                    type: cols[4],
                    address: cols[5],
                    last_recharge: cols[6] || null,
                    box_number: cols[7] || null,
                    mac_address: cols[8] || null,
                    mobile: cols[9] || null
                };
            });

            executeRestore({ customers, type: 'all' }); // CSV restore assumes 'all' scope for customers unless we infer otherwise
        }
    } catch (e) {
        Alert.alert('Error', 'Invalid data format. Please check your input.');
    }
  };

  const handleQuickReport = async () => {
      const reportCustomers = customers.filter(c => {
        if (reportStatusFilter !== 'all' && c.status !== reportStatusFilter) return false;
        if (reportTypeFilter !== 'all' && c.type !== reportTypeFilter) return false;
        
        if (!reportStartDate && !reportEndDate) return true;
        const date = c.lastRecharge || '';
        if (!date) return false;
        if (reportStartDate && date < reportStartDate) return false;
        if (reportEndDate && date > reportEndDate) return false;
        return true;
      });

      const total = reportCustomers.length;
      const paid = reportCustomers.filter(c => c.status === 'paid').length;
      const unpaid = reportCustomers.filter(c => c.status === 'unpaid').length;
      const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
      const paidPercent = total > 0 ? (paid / total) * 100 : 0;

      const calculateTotalFromPackages = (packageString: string) => {
          if (!packageString) return 0;
          const names = packageString.split(',').map(s => s.trim());
          return names.reduce((sum, name) => {
              const pkg = packages.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
              if (!pkg) return sum;
              const val = parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0;
              return sum + val;
          }, 0);
      };

      const totalRevenue = reportCustomers
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package), 0);

      const cableRevenue = reportCustomers
        .filter(c => c.type === 'cable' && c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package), 0);

      const internetRevenue = reportCustomers
        .filter(c => c.type === 'internet' && c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package), 0);
      
      const cablePercent = totalRevenue > 0 ? (cableRevenue / totalRevenue) * 100 : 0;

      const unpaidCustomersList = reportCustomers
        .filter(c => c.status === 'unpaid')
        .map(c => ({ ...c, amountDue: calculateTotalFromPackages(c.package, 'price') }))
        .sort((a, b) => b.amountDue - a.amountDue);

      const totalUnpaidAmount = unpaidCustomersList.reduce((sum, c) => sum + c.amountDue, 0);

      const unpaidRows = unpaidCustomersList.map(c => `
        <tr>
            <td>${c.name}</td>
            <td>${c.package}</td>
            <td>${c.mobile || '-'}</td>
            <td style="text-align: right;">₹${c.amountDue.toFixed(2)}</td>
        </tr>
      `).join('');

      const html = `
        <html>
          <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" />
            <style>
              body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 20px; padding-bottom: 60px; }
              h1 { text-align: center; color: #333; margin-bottom: 5px; }
              .logo-container { text-align: center; margin-bottom: 15px; }
              .logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; }
              .subtitle { text-align: center; color: #666; margin-bottom: 30px; }
              .summary { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background-color: #f9fafb; }
              .row { display: flex; justify-content: space-between; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
              .row:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
              .label { font-weight: bold; color: #555; }
              .value { font-weight: bold; font-size: 16px; }
              .paid { color: #155724; }
              .unpaid { color: #721c24; }
              .charts-row { display: flex; justify-content: space-around; flex-wrap: wrap; margin-top: 30px; }
              .chart-container { margin-bottom: 20px; display: flex; flex-direction: column; align-items: center; page-break-inside: avoid; }
              .pie-chart { width: 150px; height: 150px; border-radius: 50%; border: 1px solid #eee; }
              .legend { margin-top: 15px; display: flex; gap: 20px; }
              .legend-item { display: flex; align-items: center; font-size: 14px; color: #555; }
              .color-box { width: 12px; height: 12px; margin-right: 8px; border-radius: 2px; }
              .unpaid-section { margin-top: 30px; }
              .unpaid-table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
              .unpaid-table th { text-align: left; background-color: #f3f4f6; padding: 8px; border-bottom: 2px solid #e5e7eb; color: #374151; }
              .unpaid-table td { padding: 8px; border-bottom: 1px solid #e5e7eb; color: #4b5563; }
              .unpaid-table tr:last-child td { border-bottom: none; }
              .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; color: #888; font-size: 10px; padding: 10px; border-top: 1px solid #eee; background-color: white; }
            </style>
          </head>
          <body>
            <div class="logo-container">
                ${profile.avatar ? `<img src="${profile.avatar}" class="logo" />` : '<span style="font-size: 60px;">⚙️</span>'}
            </div>
            <h1>Quick Report</h1>
            <div class="subtitle">
              ${reportTypeFilter !== 'all' ? `Type: ${reportTypeFilter.toUpperCase()} • ` : ''}${reportStatusFilter !== 'all' ? `Status: ${reportStatusFilter.toUpperCase()} • ` : ''}${reportStartDate || reportEndDate ? `${reportStartDate || 'Start'} to ${reportEndDate || 'End'}` : 'All Time Summary'}
            </div>
            
            <div class="summary">
              <div class="row">
                <span class="label">Total Customers</span>
                <span class="value">${total}</span>
              </div>
              <div class="row">
                <span class="label">Paid Customers</span>
                <span class="value paid">${paid}</span>
              </div>
              <div class="row">
                <span class="label">Unpaid Customers</span>
                <span class="value unpaid">${unpaid}</span>
              </div>
              <div class="row">
                <span class="label">Payment Rate</span>
                <span class="value">${rate}%</span>
              </div>
              <div class="row">
                <span class="label">Total Revenue</span>
                <span class="value" style="font-size: 20px; color: #2563eb;">₹${totalRevenue.toFixed(2)}</span>
              </div>
            </div>

            <div class="charts-row">
                <div class="chart-container">
                    <h3>Payment Status</h3>
                    <div class="pie-chart" style="background: conic-gradient(#155724 0% ${paidPercent}%, #721c24 ${paidPercent}% 100%);"></div>
                    <div class="legend">
                        <div class="legend-item"><div class="color-box" style="background: #155724"></div>Paid (${paid})</div>
                        <div class="legend-item"><div class="color-box" style="background: #721c24"></div>Unpaid (${unpaid})</div>
                    </div>
                </div>

                <div class="chart-container">
                    <h3>Revenue Breakdown</h3>
                    <div class="pie-chart" style="background: conic-gradient(#9b59b6 0% ${cablePercent}%, #e67e22 ${cablePercent}% 100%);"></div>
                    <div class="legend">
                        <div class="legend-item"><div class="color-box" style="background: #9b59b6"></div>Cable (₹${cableRevenue.toFixed(0)})</div>
                        <div class="legend-item"><div class="color-box" style="background: #e67e22"></div>Internet (₹${internetRevenue.toFixed(0)})</div>
                    </div>
                </div>
            </div>

            ${unpaidCustomersList.length > 0 ? `
            <div class="unpaid-section">
                <h3>Unpaid Customers List (${unpaidCustomersList.length})</h3>
                <table class="unpaid-table">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Package</th>
                            <th>Mobile</th>
                            <th style="text-align: right;">Amount</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${unpaidRows}
                        <tr style="background-color: #f9fafb; font-weight: bold; border-top: 2px solid #e5e7eb;">
                            <td colspan="3" style="text-align: right; padding-right: 10px;">Total Amount Due:</td>
                            <td style="text-align: right;">₹${totalUnpaidAmount.toFixed(2)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            ` : ''}

            <div class="footer">
              Generated via Swathi Networks App on ${new Date().toLocaleString()} &bull; Page 1
            </div>
          </body>
        </html>
      `;

      try {
        if (Platform.OS === 'web') {
          await Print.printAsync({ html });
        } else {
          const { uri } = await Print.printToFileAsync({ html });
          await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        }
      } catch (error: any) {
        Alert.alert("Error", error.message);
      }
  };

  const handleLoadSampleData = async (specificType?: 'cable' | 'internet') => {
    // Fetch packages to ensure revenue calculation works
    let { data: dbPackages } = await supabase.from('packages').select('*');
    let availablePackages = dbPackages as Package[] || [];

    // Automatically create default packages with profit margins if none exist
    if (availablePackages.length === 0) {
        const defaultPackages = [
            { name: 'Basic Cable', price: '₹300', type: 'cable', features: 'Standard Channels', active: true, my_profit: '₹50' },
            { name: 'Premium Cable', price: '₹500', type: 'cable', features: 'HD Channels + Sports', active: true, my_profit: '₹120' },
            { name: 'Fast Internet', price: '₹600', type: 'internet', features: '50 Mbps', active: true, my_profit: '₹200' },
            { name: 'Giga Fiber', price: '₹1000', type: 'internet', features: '1 Gbps', active: true, my_profit: '₹400' }
        ];

        const { error } = await supabase.from('packages').insert(defaultPackages);
        
        if (error) {
             if (error.message.includes('my_profit')) {
                Alert.alert('Database Update Required', 'Please run this SQL in Supabase: ALTER TABLE packages ADD COLUMN my_profit text;');
                return;
            }
            console.log('Error creating default packages:', error);
        } else {
            // Refetch packages after creation
            const { data: newDbPackages } = await supabase.from('packages').select('*');
            if (newDbPackages) {
                availablePackages = newDbPackages as Package[];
                fetchPackages(); // Update global state
                Alert.alert("Info", "Default packages with profit margins created.");
            }
        }
    }

    const newCustomers: Customer[] = [];
    const firstNames = ['James', 'Mary', 'John', 'Patricia', 'Robert', 'Jennifer', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];
    
    for (let i = 0; i < 50; i++) {
        const type = specificType || (Math.random() > 0.5 ? 'cable' : 'internet');
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        
        // Select a valid package if available, otherwise fallback
        const validPackages = availablePackages.filter(p => p.type === type && p.active);
        let pkgName = '';
        if (validPackages.length > 0) {
            pkgName = validPackages[Math.floor(Math.random() * validPackages.length)].name;
        } else {
            pkgName = type === 'cable' ? (Math.random() > 0.5 ? 'Basic Plan' : 'Sports Pack') : (Math.random() > 0.5 ? 'Premium Fiber' : 'Standard');
        }
        
        // Map to DB structure
        await supabase.from('customers').insert([{
            name: `${firstName} ${lastName}`,
            package: pkgName,
            status: Math.random() > 0.2 ? 'paid' : 'unpaid',
            type: type,
            address: `${Math.floor(Math.random() * 999) + 1} ${['Main', 'Oak', 'Pine', 'Maple', 'Cedar', 'Elm'][Math.floor(Math.random() * 6)]} St`,
            last_recharge: new Date(Date.now() - Math.floor(Math.random() * 60) * 86400000).toISOString().split('T')[0],
            box_number: type === 'cable' ? `BOX-${1000 + i}` : null,
            mac_address: type === 'internet' ? `00:1A:2B:3C:4D:${(10 + i).toString(16).toUpperCase().padStart(2, '0')}` : null,
            mobile: `555${Math.floor(1000000 + Math.random() * 9000000).toString().substring(0, 7)}`
        }]);
    }
    fetchCustomers();
    Alert.alert("Success", `50 sample ${specificType || 'mixed'} customer records loaded.`);
  };

  const handleExportData = async () => {
    try {
      const header = "ID,Name,Type,Package,Status,Address,Mobile,Last Recharge,Box Number,MAC Address\n";
      const rows = customers.map(c => 
        `${c.id},"${c.name}",${c.type},"${c.package}",${c.status},"${c.address}",${c.mobile || ''},${c.lastRecharge || ''},${c.boxNumber || ''},${c.macAddress || ''}`
      ).join("\n");
      
      const csv = header + rows;

      const fileName = 'Customer_Data_Export.csv';

      if (Platform.OS === 'web') {
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        link.click();
        return;
      }

      const fileUri = FileSystem.documentDirectory + fileName;
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });

      if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri);
      } else {
          Alert.alert('Error', 'Sharing is not available on this device');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getDaysRemaining = (lastRecharge?: string) => {
    if (!lastRecharge) return null;
    const rechargeDate = new Date(lastRecharge);
    if (isNaN(rechargeDate.getTime())) return null;
    
    const expiryDate = new Date(rechargeDate);
    expiryDate.setDate(rechargeDate.getDate() + 30);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expiryDate.setHours(0, 0, 0, 0);
    
    const diffTime = expiryDate.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleAutoExpire = async () => {
    const expiredPaidCustomers = customers.filter(c => {
        if (c.status !== 'paid') return false;
        // Check if expired based on last recharge date
        const daysLeft = getDaysRemaining(c.lastRecharge);
        return daysLeft !== null && daysLeft < 0;
    });

    if (expiredPaidCustomers.length === 0) {
        Alert.alert("Info", "No expired 'Paid' customers found.");
        return;
    }

    Alert.alert(
        "Confirm Auto-Expire",
        `Found ${expiredPaidCustomers.length} customers who are marked 'Paid' but have expired.\n\nUpdate their status to 'Unpaid'?`,
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Update Status", 
                onPress: async () => {
                    const ids = expiredPaidCustomers.map(c => c.id);
                    
                    const { error } = await supabase
                        .from('customers')
                        .update({ status: 'unpaid' })
                        .in('id', ids);

                    if (error) {
                        Alert.alert("Error", error.message);
                    } else {
                        const historyEntries = expiredPaidCustomers.map(c => ({
                            customer_id: c.id,
                            action: 'Auto Expire',
                            details: `Status updated to Unpaid due to expiration (Last Recharge: ${c.lastRecharge})`,
                            timestamp: new Date().toISOString()
                        }));
                        
                        await supabase.from('customer_history').insert(historyEntries);
                        
                        fetchCustomers();
                        Alert.alert("Success", `Updated ${ids.length} customers to 'Unpaid'.`);
                    }
                }
            }
        ]
    );
  };

  const renderContent = () => {
    if (activeTab === 'cable' || activeTab === 'internet') {
      return (
        <View style={[styles.sectionContainer, isDarkMode && styles.darkContainer]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{activeTab === 'cable' ? 'Cable' : 'Internet'} Customers</Text>
          </View>
          
          <View style={styles.searchContainer}>
            <TextInput 
              style={[styles.searchInput, isDarkMode && styles.darkInput]}
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              placeholder="Search name, address, mobile..."
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <View style={styles.filterContainer}>
              {(['all', 'paid', 'unpaid'] as const).map(status => (
                <TouchableOpacity 
                  key={status}
                  style={[
                    styles.filterBtn, 
                    isDarkMode && styles.darkFilterBtn,
                    statusFilter === status && styles.filterBtnActive
                  ]}
                  onPress={() => setStatusFilter(status)}
                >
                  <Text style={[
                    styles.filterBtnText, 
                    isDarkMode && styles.darkSubText,
                    statusFilter === status && styles.filterBtnTextActive
                  ]}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={{marginTop: 10}}>
                <Text style={[styles.label, {fontSize: 12, marginBottom: 5}, isDarkMode && styles.darkSubText]}>Filter by Package:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity 
                        style={[
                            styles.filterBtn, 
                            isDarkMode && styles.darkFilterBtn, 
                            !packageFilter && styles.filterBtnActive,
                            {marginRight: 8}
                        ]}
                        onPress={() => setPackageFilter('')}
                    >
                        <Text style={[
                            styles.filterBtnText, 
                            isDarkMode && styles.darkSubText,
                            !packageFilter && styles.filterBtnTextActive
                        ]}>All</Text>
                    </TouchableOpacity>
                    {packages
                        .filter(p => p.type === activeTab && p.active)
                        .map(p => (
                        <TouchableOpacity 
                            key={p.id}
                            style={[
                                styles.filterBtn, 
                                isDarkMode && styles.darkFilterBtn, 
                                packageFilter === p.name && styles.filterBtnActive,
                                {marginRight: 8}
                            ]}
                            onPress={() => setPackageFilter(packageFilter === p.name ? '' : p.name)}
                        >
                            <Text style={[
                                styles.filterBtnText, 
                                isDarkMode && styles.darkSubText,
                                packageFilter === p.name && styles.filterBtnTextActive
                            ]}>{p.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={styles.sortContainer}>
              <TouchableOpacity 
                style={styles.sortBtn}
                onPress={() => setShowViewOptions(true)}
              >
                <Text style={styles.sortBtnText}>View: {viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} ▾</Text>
              </TouchableOpacity>
              <Text style={[styles.sortLabel, { marginLeft: 10 }, isDarkMode && styles.darkSubText]}>Count: {filteredCustomers.length}</Text>
            </View>
          </View>
          
          <FlatList
            key={viewMode}
            data={filteredCustomers}
            keyExtractor={item => item.id}
            numColumns={viewMode === 'grid' ? 2 : 1}
            columnWrapperStyle={viewMode === 'grid' ? { justifyContent: 'space-between' } : undefined}
            contentContainerStyle={styles.listContent}
            refreshing={refreshing}
            onRefresh={onRefresh}
            renderItem={({ item }) => {
              const isSelected = selectedCustomerIds.includes(item.id);
              if (viewMode === 'grid') {
                return (
                  <Pressable 
                    onLongPress={() => !isSelectionMode && handleLongPress(item.id)}
                    onPress={() => isSelectionMode && toggleSelection(item.id)}
                    style={[
                        styles.card, 
                        isDarkMode && styles.darkCard, 
                        { width: '48%' },
                        isSelected && { borderColor: '#2563eb', borderWidth: 2, backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }
                    ]}
                  >
                    <View style={styles.cardHeader}>
                      <Text style={[styles.cardTitle, {fontSize: 16}, isDarkMode && styles.darkText]} numberOfLines={1}>{item.name}</Text>
                    </View>
                    <Text style={[styles.cardValue, {fontSize: 12, marginBottom: 8}, isDarkMode && styles.darkText]} numberOfLines={1}>{item.package}</Text>
                    <View style={[styles.badge, item.status === 'paid' ? styles.badgeSuccess : styles.badgeDanger, {alignSelf: 'flex-start', marginBottom: 10}]}>
                        <Text style={[styles.badgeText, { fontSize: 10, color: item.status === 'paid' ? '#155724' : '#721c24' }]}>
                          {item.status}
                          {item.excludeFromReset && ' (Excl.)'}
                        </Text>
                    </View>
                    {item.lastRecharge && (
                        <Text style={{fontSize: 10, color: (getDaysRemaining(item.lastRecharge) || 0) < 0 ? '#ef4444' : ((getDaysRemaining(item.lastRecharge) || 0) <= 5 ? '#f59e0b' : '#6b7280'), marginBottom: 5}}>
                            {(getDaysRemaining(item.lastRecharge) || 0) < 0 ? `Expired ${Math.abs(getDaysRemaining(item.lastRecharge) || 0)}d ago` : `${getDaysRemaining(item.lastRecharge)}d left`}
                        </Text>
                    )}
                    {!isSelectionMode && (
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto'}}>
                        <TouchableOpacity onPress={() => handleEditCustomer(item)}>
                            <Text style={styles.btnEditText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteCustomer(item.id)}>
                            <Text style={styles.btnDeleteText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                    )}
                  </Pressable>
                );
              }

              if (viewMode === 'list') {
                return (
                  <Pressable 
                    onLongPress={() => !isSelectionMode && handleLongPress(item.id)}
                    onPress={() => isSelectionMode && toggleSelection(item.id)}
                    style={[
                        styles.card, 
                        isDarkMode && styles.darkCard, 
                        { flexDirection: 'row', alignItems: 'center', padding: 12, justifyContent: 'space-between' },
                        isSelected && { borderColor: '#2563eb', borderWidth: 2, backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }
                    ]}
                  >
                    <View style={{flex: 1}}>
                        <Text style={[styles.cardTitle, {fontSize: 16, marginBottom: 2}, isDarkMode && styles.darkText]} numberOfLines={1}>{item.name}</Text>
                        <Text style={[styles.cardValue, {fontSize: 12}, isDarkMode && styles.darkText]} numberOfLines={1}>{item.package}</Text>
                        {item.lastRecharge && (
                            <Text style={{fontSize: 10, color: (getDaysRemaining(item.lastRecharge) || 0) < 0 ? '#ef4444' : ((getDaysRemaining(item.lastRecharge) || 0) <= 5 ? '#f59e0b' : '#6b7280'), marginTop: 2}}>
                                {(getDaysRemaining(item.lastRecharge) || 0) < 0 ? `Expired ${Math.abs(getDaysRemaining(item.lastRecharge) || 0)}d ago` : `${getDaysRemaining(item.lastRecharge)}d left`}
                            </Text>
                        )}
                    </View>
                    <View style={{ width: 70, alignItems: 'center' }}>
                        <Text style={[styles.cardValue, {fontSize: 12, fontWeight: 'bold', color: '#6b7280'}, isDarkMode && styles.darkSubText]}>{item.type.toUpperCase()}</Text>
                    </View>
                    <View style={[styles.badge, item.status === 'paid' ? styles.badgeSuccess : styles.badgeDanger, {marginHorizontal: 10}]}>
                        <Text style={[styles.badgeText, { fontSize: 10, color: item.status === 'paid' ? '#155724' : '#721c24' }]}>{item.status}</Text>
                    </View>
                    {item.excludeFromReset && <Text style={{fontSize: 10, color: '#6b7280', marginRight: 5}}>Excl.</Text>}
                    {!isSelectionMode && (
                    <View style={{flexDirection: 'row', gap: 10}}>
                        <TouchableOpacity onPress={() => handleEditCustomer(item)}>
                            <Text style={styles.btnEditText}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteCustomer(item.id)}>
                            <Text style={styles.btnDeleteText}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                    )}
                  </Pressable>
                );
              }

              return (
              <Pressable 
                onLongPress={() => !isSelectionMode && handleLongPress(item.id)}
                onPress={() => isSelectionMode && toggleSelection(item.id)}
                style={[styles.card, isDarkMode && styles.darkCard, isSelected && { borderColor: '#2563eb', borderWidth: 2, backgroundColor: isDarkMode ? '#1e3a8a' : '#eff6ff' }]}
              >
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>{item.name}</Text>
                  <View style={[styles.badge, item.status === 'paid' ? styles.badgeSuccess : styles.badgeDanger]}>
                    <Text style={[styles.badgeText, { color: item.status === 'paid' ? '#155724' : '#721c24' }]}>
                      {item.status}
                      {item.excludeFromReset && ' (Excluded)'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Package:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.package}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Address:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.address}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Mobile:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.mobile || 'N/A'}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>{item.type === 'cable' ? 'Box No:' : 'MAC:'}</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.type === 'cable' ? (item.boxNumber || 'N/A') : (item.macAddress || 'N/A')}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Recharge:</Text>
                    <View style={{flex: 1}}>
                        <Text style={[styles.cardValue, isDarkMode && styles.darkText, {flex: 0}]}>{item.lastRecharge || 'N/A'}</Text>
                        {item.lastRecharge && (
                            <Text style={{
                                fontSize: 12, 
                                fontWeight: 'bold', 
                                marginTop: 2,
                                color: (getDaysRemaining(item.lastRecharge) || 0) < 0 ? '#ef4444' : ((getDaysRemaining(item.lastRecharge) || 0) <= 5 ? '#f59e0b' : '#10b981')
                            }}>
                                {(getDaysRemaining(item.lastRecharge) || 0) < 0 ? `Expired ${Math.abs(getDaysRemaining(item.lastRecharge) || 0)} days ago` : ((getDaysRemaining(item.lastRecharge) || 0) === 0 ? 'Expires Today' : `${getDaysRemaining(item.lastRecharge)} days remaining`)}
                            </Text>
                        )}
                    </View>
                </View>
                {!isSelectionMode && (
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.btnShare} onPress={() => handleShareInvoice(item)}>
                    <Text style={styles.btnShareText}>Invoice</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnEdit, {backgroundColor: '#f3f4f6'}]} onPress={() => handleViewHistory(item)}>
                    <Text style={[styles.btnEditText, {color: '#4b5563'}]}>History</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnEdit} onPress={() => handleEditCustomer(item)}>
                    <Text style={styles.btnEditText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnDelete} onPress={() => handleDeleteCustomer(item.id)}>
                    <Text style={styles.btnDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
                )}
              </Pressable>
            )}}
            ListEmptyComponent={
                <View style={styles.emptyState}>
                    <Text style={styles.emptyText}>No customers found.</Text>
                </View>
            }
          />
          
          {isSelectionMode && (
              <View style={[styles.bulkActionBar, isDarkMode && styles.darkCard]}>
                  <Text style={[styles.bulkActionText, isDarkMode && styles.darkText]}>{selectedCustomerIds.length} Selected</Text>
                  <View style={{flexDirection: 'row', gap: 10}}>
                      <TouchableOpacity style={[styles.btnSecondary, {paddingVertical: 8}]} onPress={() => { setIsSelectionMode(false); setSelectedCustomerIds([]); }}>
                          <Text style={styles.btnTextSecondary}>Cancel</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btnPrimary, {marginTop: 0, paddingVertical: 8, backgroundColor: '#ef4444'}]} onPress={() => handleBulkUpdateExclude(false)}>
                          <Text style={styles.btnText}>Include</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.btnPrimary, {marginTop: 0, paddingVertical: 8}]} onPress={() => handleBulkUpdateExclude(true)}>
                          <Text style={styles.btnText}>Exclude</Text>
                      </TouchableOpacity>
                  </View>
              </View>
          )}
        </View>
      );
    }

    if (activeTab === 'packages') {
      const filteredPackages = packages.filter(p => 
        p.name.toLowerCase().includes(packageSearchQuery.toLowerCase())
      );
      
      const filteredBundles = bundles.filter(b => 
        b.name.toLowerCase().includes(packageSearchQuery.toLowerCase())
      );

      return (
        <View style={[styles.sectionContainer, isDarkMode && styles.darkContainer]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Packages</Text>
            <View style={{flexDirection: 'row', gap: 10}}>
                <View style={{flexDirection: 'row', backgroundColor: isDarkMode ? '#374151' : '#e5e7eb', borderRadius: 8, padding: 2}}>
                    <TouchableOpacity onPress={() => setActivePackageSubTab('packages')} style={{paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: activePackageSubTab === 'packages' ? (isDarkMode ? '#4b5563' : 'white') : 'transparent'}}>
                        <Text style={{fontSize: 12, fontWeight: '600', color: isDarkMode ? '#f9fafb' : '#374151'}}>Packages</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setActivePackageSubTab('bundles')} style={{paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6, backgroundColor: activePackageSubTab === 'bundles' ? (isDarkMode ? '#4b5563' : 'white') : 'transparent'}}>
                        <Text style={{fontSize: 12, fontWeight: '600', color: isDarkMode ? '#f9fafb' : '#374151'}}>Bundles</Text>
                    </TouchableOpacity>
                </View>
            </View>
          </View>

          <View style={styles.searchContainer}>
            <TextInput 
              style={[styles.searchInput, isDarkMode && styles.darkInput]}
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              placeholder={`Search ${activePackageSubTab}...`}
              value={packageSearchQuery}
              onChangeText={setPackageSearchQuery}
            />
          </View>
          
          {activePackageSubTab === 'packages' ? (
          <FlatList
            data={filteredPackages}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[styles.card, isDarkMode && styles.darkCard]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>{item.name}</Text>
                  <View style={[styles.badge, item.active ? styles.badgeSuccess : styles.badgeDanger]}>
                    <Text style={[styles.badgeText, { color: item.active ? '#155724' : '#721c24' }]}>
                      {item.active ? 'Active' : 'Inactive'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Type:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.type.charAt(0).toUpperCase() + item.type.slice(1)}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Price:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.price}</Text>
                </View>
                {item.myProfit && <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>My Profit:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.myProfit}</Text>
                </View>}
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Features:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.features}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.btnEdit} onPress={() => handleEditPackage(item)}>
                    <Text style={styles.btnEditText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnDelete} onPress={() => handleDeletePackage(item.id)}>
                    <Text style={styles.btnDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
          ) : (
            <FlatList
            data={filteredBundles}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
                const bundleItems = item.items.split(',').map(s => s.trim());
                const totalPrice = bundleItems.reduce((sum, name) => {
                    const pkg = packages.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
                    return sum + (pkg ? (parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0) : 0);
                }, 0);

                return (
              <View style={[styles.card, isDarkMode && styles.darkCard]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardTitle, isDarkMode && styles.darkText]}>{item.name}</Text>
                  <Text style={[styles.cardValue, {fontWeight: 'bold', textAlign: 'right'}, isDarkMode && styles.darkText]}>₹{totalPrice.toFixed(2)}</Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Includes:</Text>
                    <Text style={[styles.cardValue, isDarkMode && styles.darkText]}>{item.items}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.btnEdit} onPress={() => handleEditBundle(item)}>
                    <Text style={styles.btnEditText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.btnDelete} onPress={() => handleDeleteBundle(item.id)}>
                    <Text style={styles.btnDeleteText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}}
            ListEmptyComponent={<Text style={{textAlign: 'center', padding: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>No bundles created yet.</Text>}
          />
          )}
        </View>
      );
    }

    if (activeTab === 'reports') {
      const reportCustomers = customers.filter(c => {
        if (!reportStartDate && !reportEndDate) return true;
        const date = c.lastRecharge || '';
        if (!date) return false;
        if (reportStartDate && date < reportStartDate) return false;
        if (reportEndDate && date > reportEndDate) return false;
        return true;
      });

      const total = reportCustomers.length;
      const paid = reportCustomers.filter(c => c.status === 'paid').length;
      const unpaid = reportCustomers.filter(c => c.status === 'unpaid').length;
      const cable = reportCustomers.filter(c => c.type === 'cable').length;
      const internet = reportCustomers.filter(c => c.type === 'internet').length;
      const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
      
      const cablePercent = total > 0 ? cable / total : 0;
      const internetPercent = total > 0 ? internet / total : 0;
      const paidPercent = total > 0 ? paid / total : 0;
      const unpaidPercent = total > 0 ? unpaid / total : 0;

      const packageStats = reportCustomers.reduce((acc, curr) => {
        const pkgs = curr.package.split(',').map(s => s.trim());
        pkgs.forEach(p => {
            if(p) acc[p] = (acc[p] || 0) + 1;
        });
        return acc;
      }, {} as Record<string, number>);

      const packageColors = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#f87171', '#22d3ee', '#fb923c'];
      const packageChartData = Object.entries(packageStats).map(([name, count], index) => ({
        name,
        count,
        percent: total > 0 ? count / total : 0,
        color: packageColors[index % packageColors.length]
      })).sort((a, b) => b.count - a.count);

      const calculateTotalFromPackages = (packageString: string, type: 'price' | 'profit') => {
          if (!packageString) return 0;
          const names = packageString.split(',').map(s => s.trim());
          return names.reduce((sum, name) => {
              const pkg = packages.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
              if (!pkg) return sum;
              const valStr = type === 'price' ? pkg.price : (pkg.myProfit || '0');
              const val = parseFloat(valStr.replace(/[^0-9.]/g, '')) || 0;
              return sum + val;
          }, 0);
      };

      const cableRevenue = reportCustomers
        .filter(c => c.type === 'cable' && c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'price'), 0);

      const internetRevenue = reportCustomers
        .filter(c => c.type === 'internet' && c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'price'), 0);

      const totalRevenue = reportCustomers
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'price'), 0);

      const cableProfit = reportCustomers
        .filter(c => c.type === 'cable' && c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'profit'), 0);

      const internetProfit = reportCustomers
        .filter(c => c.type === 'internet' && c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'profit'), 0);

      const totalProfit = reportCustomers
        .filter(c => c.status === 'paid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'profit'), 0);

      const totalDue = reportCustomers
        .filter(c => c.status === 'unpaid')
        .reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'price'), 0);

      const maxRevenue = Math.max(cableRevenue, internetRevenue, 1);
      const cableBarHeight = (cableRevenue / maxRevenue) * 100;
      const internetBarHeight = (internetRevenue / maxRevenue) * 100;

      const revenueStats = reportCustomers
        .filter(c => c.status === 'paid')
        .reduce((acc, curr) => {
          const pkgs = curr.package.split(',').map(s => s.trim());
          pkgs.forEach(p => {
              const pkg = packages.find(pkg => pkg.name.trim().toLowerCase() === p.toLowerCase());
              const price = pkg ? (parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0) : 0;
              acc[p] = (acc[p] || 0) + price;
          });
          return acc;
        }, {} as Record<string, number>);

      const totalPaidRevenue = cableRevenue + internetRevenue;
      const revenueChartData = Object.entries(revenueStats).map(([name, value], index) => ({
        name,
        value,
        percent: totalPaidRevenue > 0 ? value / totalPaidRevenue : 0,
        color: packageColors[index % packageColors.length]
      })).sort((a, b) => b.value - a.value);

      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        return {
          month: d.getMonth(),
          year: d.getFullYear(),
          label: monthNames[d.getMonth()]
        };
      }).reverse();

      const trendData = last6Months.map(m => {
        const monthCustomers = customers.filter(c => {
            if (!c.lastRecharge) return false;
            const d = new Date(c.lastRecharge);
            return d.getMonth() === m.month && d.getFullYear() === m.year;
        });
        const cable = monthCustomers.filter(c => c.type === 'cable' && c.status === 'paid').reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'price'), 0);
        const internet = monthCustomers.filter(c => c.type === 'internet' && c.status === 'paid').reduce((sum, c) => sum + calculateTotalFromPackages(c.package, 'price'), 0);
        return { label: m.label, cable, internet };
      });
      const maxTrendValue = Math.max(...trendData.map(d => Math.max(d.cable, d.internet)), 100);

      return (
        <ScrollView style={[styles.sectionContainer, isDarkMode && styles.darkContainer]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Reports</Text>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard, { marginBottom: 15 }]}>
            <Text style={[styles.cardTitle, {fontSize: 16, marginBottom: 10}, isDarkMode && styles.darkText]}>Filter by Last Recharge</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                <View style={{flex: 1}}>
                    <Text style={[styles.label, {fontSize: 12}, isDarkMode && styles.darkLabel]}>Start Date</Text>
                    <TextInput 
                        style={[styles.input, {paddingVertical: 8}, isDarkMode && styles.darkInput]} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                        value={reportStartDate} 
                        onChangeText={setReportStartDate} 
                    />
                </View>
                <View style={{flex: 1}}>
                    <Text style={[styles.label, {fontSize: 12}, isDarkMode && styles.darkLabel]}>End Date</Text>
                    <TextInput 
                        style={[styles.input, {paddingVertical: 8}, isDarkMode && styles.darkInput]} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                        value={reportEndDate} 
                        onChangeText={setReportEndDate} 
                    />
                </View>
            </View>
            <View style={{flexDirection: 'row', gap: 8}}>
                <TouchableOpacity style={[styles.btnSecondary, {paddingVertical: 6}, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => {
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];
                    setReportStartDate(thirtyDaysAgo);
                    setReportEndDate(new Date().toISOString().split('T')[0]);
                }}>
                    <Text style={[styles.btnTextSecondary, {fontSize: 12}, isDarkMode && styles.darkText]}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnSecondary, {paddingVertical: 6}, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => {
                    setReportStartDate('');
                    setReportEndDate('');
                }}>
                    <Text style={[styles.btnTextSecondary, {fontSize: 12}, isDarkMode && styles.darkText]}>Clear Filter</Text>
                </TouchableOpacity>
            </View>
          </View>
          
          <View style={styles.reportsGrid}>
            <View style={[styles.reportCard, isDarkMode && styles.darkCard]}>
                <Text style={[styles.reportLabel, isDarkMode && styles.darkSubText]}>Total Customers</Text>
                <Text style={[styles.reportValue, isDarkMode && styles.darkText]}>{total}</Text>
            </View>
            <View style={[styles.reportCard, isDarkMode && styles.darkCard]}>
                <Text style={[styles.reportLabel, {color: '#155724'}, isDarkMode && {color: '#4ade80'}]}>Paid</Text>
                <Text style={[styles.reportValue, {color: '#155724'}, isDarkMode && {color: '#4ade80'}]}>{paid}</Text>
            </View>
            <View style={[styles.reportCard, isDarkMode && styles.darkCard]}>
                <Text style={[styles.reportLabel, {color: '#721c24'}, isDarkMode && {color: '#f87171'}]}>Unpaid</Text>
                <Text style={[styles.reportValue, {color: '#721c24'}, isDarkMode && {color: '#f87171'}]}>{unpaid}</Text>
            </View>
            <View style={[styles.reportCard, isDarkMode && styles.darkCard]}>
                <Text style={[styles.reportLabel, {color: '#2563eb'}, isDarkMode && {color: '#60a5fa'}]}>Payment Rate</Text>
                <Text style={[styles.reportValue, {color: '#2563eb'}, isDarkMode && {color: '#60a5fa'}]}>{rate}%</Text>
            </View>
             <View style={[styles.reportCard, isDarkMode && styles.darkCard]}>
                <Text style={[styles.reportLabel, {color: '#9b59b6'}, isDarkMode && {color: '#c084fc'}]}>Cable</Text>
                <Text style={[styles.reportValue, {color: '#9b59b6'}, isDarkMode && {color: '#c084fc'}]}>{cable}</Text>
            </View>
             <View style={[styles.reportCard, isDarkMode && styles.darkCard]}>
                <Text style={[styles.reportLabel, {color: '#e67e22'}, isDarkMode && {color: '#fb923c'}]}>Internet</Text>
                <Text style={[styles.reportValue, {color: '#e67e22'}, isDarkMode && {color: '#fb923c'}]}>{internet}</Text>
            </View>
            
            {/* Financial Overview Card */}
            <View style={[styles.card, isDarkMode && styles.darkCard, { width: '100%', padding: 0, overflow: 'hidden', marginTop: 5 }]}>
                <View style={{ padding: 20, backgroundColor: isDarkMode ? '#064e3b' : '#ecfdf5', alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: isDarkMode ? '#6ee7b7' : '#047857', fontWeight: '700', letterSpacing: 1, marginBottom: 5, textTransform: 'uppercase' }}>Total Collected Revenue</Text>
                    <Text style={{ fontSize: 36, fontWeight: 'bold', color: isDarkMode ? '#d1fae5' : '#065f46' }}>₹{totalRevenue.toFixed(2)}</Text>
                </View>
                
                <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                    <View style={{ flex: 1, padding: 15, alignItems: 'center', borderRightWidth: 1, borderRightColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                        <Text style={{ fontSize: 11, color: '#9b59b6', fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' }}>Cable Revenue</Text>
                        <Text style={[{fontSize: 16, fontWeight: 'bold', color: '#374151'}, isDarkMode && styles.darkText]}>₹{cableRevenue.toFixed(2)}</Text>
                    </View>
                    <View style={{ flex: 1, padding: 15, alignItems: 'center' }}>
                        <Text style={{ fontSize: 11, color: '#e67e22', fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' }}>Internet Revenue</Text>
                        <Text style={[{fontSize: 16, fontWeight: 'bold', color: '#374151'}, isDarkMode && styles.darkText]}>₹{internetRevenue.toFixed(2)}</Text>
                    </View>
            </View>

            <View style={{ padding: 15, backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5', borderTopWidth: 1, borderTopColor: isDarkMode ? '#064e3b' : '#d1fae5', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: isDarkMode ? '#34d399' : '#059669', fontWeight: '600', fontSize: 14 }}>Total Profit</Text>
                <Text style={{ color: isDarkMode ? '#34d399' : '#059669', fontWeight: 'bold', fontSize: 16 }}>₹{totalProfit.toFixed(2)}</Text>
                </View>

            <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: isDarkMode ? '#064e3b' : '#d1fae5', backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4' }}>
                <View style={{ flex: 1, padding: 10, alignItems: 'center', borderRightWidth: 1, borderRightColor: isDarkMode ? '#064e3b' : '#d1fae5' }}>
                    <Text style={{ fontSize: 10, color: isDarkMode ? '#34d399' : '#059669', fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' }}>Cable Profit</Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669' }}>₹{cableProfit.toFixed(2)}</Text>
                </View>
                <View style={{ flex: 1, padding: 10, alignItems: 'center' }}>
                    <Text style={{ fontSize: 10, color: isDarkMode ? '#34d399' : '#059669', fontWeight: 'bold', marginBottom: 2, textTransform: 'uppercase' }}>Internet Profit</Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: isDarkMode ? '#34d399' : '#059669' }}>₹{internetProfit.toFixed(2)}</Text>
                </View>
            </View>

                <View style={{ padding: 15, backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.2)' : '#fef2f2', borderTopWidth: 1, borderTopColor: isDarkMode ? '#7f1d1d' : '#fecaca', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ color: isDarkMode ? '#f87171' : '#ef4444', fontWeight: '600', fontSize: 14 }}>Total Amount Due</Text>
                    <Text style={{ color: isDarkMode ? '#f87171' : '#ef4444', fontWeight: 'bold', fontSize: 16 }}>₹{totalDue.toFixed(2)}</Text>
                </View>
            </View>
          </View>

          {/* Charts */}
          <View style={[styles.card, isDarkMode && styles.darkCard, { marginTop: 10 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 15 }, isDarkMode && styles.darkText]}>Service Distribution</Text>
            <View style={{ height: 24, flexDirection: 'row', borderRadius: 12, overflow: 'hidden', backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                {cablePercent > 0 && <View style={{ flex: cablePercent, backgroundColor: '#9b59b6' }} />}
                {internetPercent > 0 && <View style={{ flex: internetPercent, backgroundColor: '#e67e22' }} />}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#9b59b6', borderRadius: 5, marginRight: 6 }} />
                    <Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>Cable ({Math.round(cablePercent * 100)}%)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#e67e22', borderRadius: 5, marginRight: 6 }} />
                    <Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>Internet ({Math.round(internetPercent * 100)}%)</Text>
                </View>
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard, { marginTop: 10 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 15 }, isDarkMode && styles.darkText]}>Payment Status</Text>
            <View style={{ height: 24, flexDirection: 'row', borderRadius: 12, overflow: 'hidden', backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                {paidPercent > 0 && <View style={{ flex: paidPercent, backgroundColor: '#10b981' }} />}
                {unpaidPercent > 0 && <View style={{ flex: unpaidPercent, backgroundColor: '#ef4444' }} />}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#10b981', borderRadius: 5, marginRight: 6 }} />
                    <Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>Paid ({Math.round(paidPercent * 100)}%)</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 10, height: 10, backgroundColor: '#ef4444', borderRadius: 5, marginRight: 6 }} />
                    <Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>Unpaid ({Math.round(unpaidPercent * 100)}%)</Text>
                </View>
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard, { marginTop: 10 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 15 }, isDarkMode && styles.darkText]}>Package Distribution</Text>
            <View style={{ height: 24, flexDirection: 'row', borderRadius: 12, overflow: 'hidden', backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                {packageChartData.map((item, index) => (
                    <View key={index} style={{ flex: item.percent, backgroundColor: item.color }} />
                ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12, gap: 10 }}>
                {packageChartData.map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, backgroundColor: item.color, borderRadius: 5, marginRight: 6 }} />
                        <Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>{item.name} ({Math.round(item.percent * 100)}%)</Text>
                    </View>
                ))}
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard, { marginTop: 10 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 15 }, isDarkMode && styles.darkText]}>Revenue Share by Package</Text>
            <View style={{ height: 24, flexDirection: 'row', borderRadius: 12, overflow: 'hidden', backgroundColor: isDarkMode ? '#374151' : '#f3f4f6' }}>
                {revenueChartData.map((item, index) => (
                    <View key={index} style={{ flex: item.percent, backgroundColor: item.color }} />
                ))}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 12, gap: 10 }}>
                {revenueChartData.map((item, index) => (
                    <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 10, height: 10, backgroundColor: item.color, borderRadius: 5, marginRight: 6 }} />
                        <Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>{item.name} (₹{item.value.toFixed(2)})</Text>
                    </View>
                ))}
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard, { marginTop: 10 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 15 }, isDarkMode && styles.darkText]}>Revenue Comparison</Text>
            <View style={{ height: 150, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                <View style={{ alignItems: 'center', width: '30%' }}>
                    <Text style={[isDarkMode && styles.darkText, {marginBottom: 5, fontSize: 12, fontWeight: 'bold'}]}>₹{cableRevenue.toFixed(0)}</Text>
                    <View style={{ width: '100%', height: `${cableBarHeight}%`, backgroundColor: '#9b59b6', borderRadius: 4, minHeight: 4 }} />
                </View>
                <View style={{ alignItems: 'center', width: '30%' }}>
                    <Text style={[isDarkMode && styles.darkText, {marginBottom: 5, fontSize: 12, fontWeight: 'bold'}]}>₹{internetRevenue.toFixed(0)}</Text>
                    <View style={{ width: '100%', height: `${internetBarHeight}%`, backgroundColor: '#e67e22', borderRadius: 4, minHeight: 4 }} />
                </View>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 }}>
                <Text style={[isDarkMode && styles.darkText, { fontWeight: '600' }]}>Cable</Text>
                <Text style={[isDarkMode && styles.darkText, { fontWeight: '600' }]}>Internet</Text>
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard, { marginTop: 10 }]}>
            <Text style={[styles.cardTitle, { marginBottom: 15 }, isDarkMode && styles.darkText]}>Revenue Trends (6 Months)</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 180, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb' }}>
                {trendData.map((item, index) => (
                    <View key={index} style={{ alignItems: 'center', flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4 }}>
                            <View style={{ width: 8, height: (item.cable / maxTrendValue) * 150, backgroundColor: '#9b59b6', borderRadius: 2 }} />
                            <View style={{ width: 8, height: (item.internet / maxTrendValue) * 150, backgroundColor: '#e67e22', borderRadius: 2 }} />
                        </View>
                        <Text style={[isDarkMode && styles.darkText, {fontSize: 10, marginTop: 5}]}>{item.label}</Text>
                    </View>
                ))}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 10, gap: 15 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 10, height: 10, backgroundColor: '#9b59b6', borderRadius: 5, marginRight: 6 }} /><Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>Cable</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 10, height: 10, backgroundColor: '#e67e22', borderRadius: 5, marginRight: 6 }} /><Text style={[isDarkMode && styles.darkText, {fontSize: 12}]}>Internet</Text></View>
            </View>
          </View>
          <View style={{height: 20}} />
        </ScrollView>
      );
    }

    if (activeTab === 'settings') {
      return (
        <ScrollView style={[styles.sectionContainer, isDarkMode && styles.darkContainer]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Settings</Text>
          </View>
          
          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Billing Cycle Settings</Text>
            <Text style={[styles.cardLabel, {marginBottom: 10}, isDarkMode && styles.darkSubText]}>
                Set the common recharge day (1-28) for monthly resets.
            </Text>
            <View style={{flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 15}}>
                <TextInput 
                    style={[styles.input, {flex: 1, marginBottom: 0}, isDarkMode && styles.darkInput]} 
                    value={commonDueDay}
                    onChangeText={setCommonDueDay}
                    keyboardType="numeric"
                    placeholder="Day (1-28)"
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                />
                <TouchableOpacity style={[styles.btnPrimary, {marginTop: 0, paddingVertical: 10}]} onPress={handleSaveCommonDueDay}>
                    <Text style={styles.btnText}>Save Day</Text>
                </TouchableOpacity>
            </View>
            
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                <Text style={[styles.label, {marginBottom: 0}, isDarkMode && styles.darkLabel]}>Auto Reset (No Confirmation)</Text>
                <Switch
                    value={autoResetEnabled}
                    onValueChange={async (val) => {
                        setAutoResetEnabled(val);
                        await AsyncStorage.setItem('autoResetEnabled', JSON.stringify(val));
                    }}
                    trackColor={{ false: "#767577", true: "#93c5fd" }}
                    thumbColor={autoResetEnabled ? "#2563eb" : "#f4f3f4"}
                />
            </View>

            <Text style={[styles.cardLabel, {marginBottom: 5}, isDarkMode && styles.darkSubText]}>
                Last Reset: {lastResetDate || 'Never'}
            </Text>
            <TouchableOpacity style={[styles.btnDelete, {alignItems: 'center'}]} onPress={handleMonthlyReset}>
                <Text style={styles.btnDeleteText}>Process Monthly Reset (Paid → Unpaid)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnDelete, {marginTop: 10, alignItems: 'center', backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.2)' : '#fef3c7'}]} onPress={handleAutoExpire}>
                <Text style={[styles.btnDeleteText, {color: isDarkMode ? '#fbbf24' : '#d97706'}]}>Auto-Expire Overdue Customers</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btnSecondary, {marginTop: 10, alignItems: 'center'}, isDarkMode && {backgroundColor: '#374151'}]} onPress={handleViewResetHistory}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>View Reset Log</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Data Management</Text>
            <Text style={[styles.cardLabel, {marginBottom: 15}, isDarkMode && styles.darkSubText]}>
              Clear all customer data from the system. This action is irreversible.
            </Text>
            <TouchableOpacity style={styles.btnDelete} onPress={handleClearData}>
              <Text style={styles.btnDeleteText}>Clear All Data</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Cloud Backups</Text>
            <Text style={[styles.cardLabel, {marginBottom: 15}, isDarkMode && styles.darkSubText]}>
              Save backups directly to the database and restore from them.
            </Text>
            
            <TouchableOpacity style={[styles.btnPrimary, {marginBottom: 15}]} onPress={() => { setNewBackupName(`Backup ${new Date().toLocaleString()}`); setBackupScope('all'); setCloudBackupModalVisible(true); }}>
                <Text style={styles.btnText}>+ Create New Cloud Backup</Text>
            </TouchableOpacity>

            <TextInput 
              style={[styles.searchInput, isDarkMode && styles.darkInput, { marginBottom: 15 }]}
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              placeholder="Search backups..."
              value={backupSearchQuery}
              onChangeText={setBackupSearchQuery}
            />

            {backups.filter(b => b.name.toLowerCase().includes(backupSearchQuery.toLowerCase())).map(backup => (
                <View key={backup.id} style={{padding: 10, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb', marginBottom: 5}}>
                    <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5}}>
                        <Text style={[isDarkMode && styles.darkText, {fontWeight: 'bold'}]}>{backup.name}</Text>
                        <Text style={{fontSize: 10, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>{new Date(backup.created_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 8}}>
                        <TouchableOpacity onPress={() => handleDownloadBackupCSV(backup)} style={{padding: 5, backgroundColor: isDarkMode ? '#374151' : '#e0f2fe', borderRadius: 4}}>
                            <Text style={{fontSize: 10, color: '#0284c7', fontWeight: 'bold'}}>CSV</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleRestoreCloudBackup(backup)} style={{padding: 5, backgroundColor: isDarkMode ? '#374151' : '#dcfce7', borderRadius: 4}}>
                            <Text style={{fontSize: 10, color: '#166534', fontWeight: 'bold'}}>Restore</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeleteBackup(backup.id)} style={{padding: 5, backgroundColor: isDarkMode ? '#374151' : '#fee2e2', borderRadius: 4}}>
                            <Text style={{fontSize: 10, color: '#991b1b', fontWeight: 'bold'}}>Delete</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
            {backups.filter(b => b.name.toLowerCase().includes(backupSearchQuery.toLowerCase())).length === 0 && <Text style={{fontStyle: 'italic', color: isDarkMode ? '#9ca3af' : '#6b7280', textAlign: 'center', marginBottom: 10}}>No cloud backups found.</Text>}
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Local Backup & Restore</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                <TouchableOpacity style={[styles.btnEdit, {flex: 1}]} onPress={() => handleBackupDatabase('all')}>
                  <Text style={styles.btnEditText}>Backup All</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnEdit, {flex: 1}]} onPress={() => handleBackupDatabase('cable')}>
                  <Text style={styles.btnEditText}>Backup Cable</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnEdit, {flex: 1}]} onPress={() => handleBackupDatabase('internet')}>
                  <Text style={styles.btnEditText}>Backup Net</Text>
                </TouchableOpacity>
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
                <TouchableOpacity style={[styles.btnEdit, {flex: 1, backgroundColor: '#fee2e2'}]} onPress={() => setRestoreModalVisible(true)}>
                  <Text style={[styles.btnEditText, {color: '#b91c1c'}]}>Paste CSV to Restore</Text>
                </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Sample Data</Text>
            <Text style={[styles.cardLabel, {marginBottom: 15}, isDarkMode && styles.darkSubText]}>
              Load sample data to test the system.
            </Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 10}}>
                <TouchableOpacity style={[styles.btnEdit, {flex: 1, backgroundColor: '#f3e8ff'}]} onPress={() => handleLoadSampleData('cable')}>
                  <Text style={[styles.btnEditText, {color: '#7e22ce'}]}>Load Cable</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnEdit, {flex: 1, backgroundColor: '#ffedd5'}]} onPress={() => handleLoadSampleData('internet')}>
                  <Text style={[styles.btnEditText, {color: '#c2410c'}]}>Load Internet</Text>
                </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.btnEdit} onPress={() => handleLoadSampleData()}>
              <Text style={styles.btnEditText}>Load Mixed Data</Text>
            </TouchableOpacity>
          </View>
          
          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Export Data</Text>
            <Text style={[styles.cardLabel, {marginBottom: 15}, isDarkMode && styles.darkSubText]}>
              Export customer list to CSV format.
            </Text>
            <TouchableOpacity style={styles.btnEdit} onPress={handleExportData}>
              <Text style={styles.btnEditText}>Export CSV</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>Recycle Bin</Text>
            <Text style={[styles.cardLabel, {marginBottom: 15}, isDarkMode && styles.darkSubText]}>
              Restore deleted customers or permanently remove them.
            </Text>
            <TouchableOpacity style={styles.btnEdit} onPress={() => setRecycleBinModalVisible(true)}>
              <Text style={styles.btnEditText}>View Recycle Bin ({deletedCustomers.length})</Text>
            </TouchableOpacity>
          </View>

           <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <Text style={[styles.cardTitle, {marginBottom: 10}, isDarkMode && styles.darkText]}>App Info</Text>
            <Text style={[styles.cardLabel, isDarkMode && styles.darkSubText]}>Version: 1.0.0</Text>
          </View>
        </ScrollView>
      );
    }

    if (activeTab === 'profile') {
      return (
        <ScrollView style={[styles.sectionContainer, isDarkMode && styles.darkContainer]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>Profile Settings</Text>
          </View>
          
          <View style={[styles.card, isDarkMode && styles.darkCard]}>
            <View style={[styles.profileHeader, isDarkMode && styles.darkCard]}>
                <TouchableOpacity onPress={pickImage} style={styles.avatarContainer}>
                    {profile.avatar ? (
                        <Image source={{ uri: profile.avatar }} style={styles.avatarImage} />
                    ) : (
                        <Text style={styles.avatarText}>{profile.name.charAt(0)}</Text>
                    )}
                </TouchableOpacity>
                <View>
                    <Text style={[styles.profileName, isDarkMode && styles.darkText]}>{profile.name}</Text>
                    <Text style={[styles.profileRole, isDarkMode && styles.darkSubText]}>Super Admin</Text>
                    <TouchableOpacity onPress={pickImage}>
                        <Text style={{color: '#2563eb', fontSize: 12, marginTop: 4}}>Change Photo</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Display Name</Text>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    value={profile.name}
                    onChangeText={(text) => setProfile({...profile, name: text})}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Username</Text>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    value={profile.username}
                    onChangeText={(text) => setProfile({...profile, username: text})}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>UPI ID (for QR Code)</Text>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    placeholder="e.g. name@upi"
                    value={profile.upiId}
                    onChangeText={(text) => setProfile({...profile, upiId: text})}
                />
            </View>

            <View style={[styles.divider, isDarkMode && {backgroundColor: '#374151'}]} />
            <Text style={[styles.sectionTitle, {fontSize: 18, marginBottom: 15}, isDarkMode && styles.darkText]}>Security</Text>

            <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Old Password</Text>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    secureTextEntry
                    placeholder="Enter current password"
                    value={profile.oldPassword}
                    onChangeText={(text) => setProfile({...profile, oldPassword: text})}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>New Password</Text>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    secureTextEntry
                    placeholder="Leave blank to keep current"
                    value={profile.password}
                    onChangeText={(text) => setProfile({...profile, password: text})}
                />
            </View>

            <View style={styles.formGroup}>
                <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Confirm Password</Text>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                    secureTextEntry
                    placeholder="Confirm new password"
                    value={profile.confirmPassword}
                    onChangeText={(text) => setProfile({...profile, confirmPassword: text})}
                />
            </View>
            
             <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveProfile}>
                <Text style={styles.btnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }
    
    return (
        <View style={styles.centerContent}>
            <Text style={styles.placeholderText}>{(activeTab as string).charAt(0).toUpperCase() + (activeTab as string).slice(1)} Section</Text>
            <Text style={styles.subPlaceholder}>Content coming soon...</Text>
        </View>
    );
  };

  return (
    <SafeAreaView style={[styles.adminContainer, isDarkMode && styles.darkContainer]}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
      {/* Header */}
      <View style={[styles.header, isDarkMode && styles.darkHeader]}>
        <TouchableOpacity onPress={handleRefresh} style={{flexDirection: 'row', alignItems: 'center'}}>
            {profile.avatar ? (
                <Image source={{ uri: profile.avatar }} style={{width: 32, height: 32, borderRadius: 16, marginRight: 8}} />
            ) : (
                <Text style={{fontSize: 24, marginRight: 8}}>⚙️</Text>
            )}
            <Text style={[styles.headerLogo, isDarkMode && styles.darkText]}>Swathi Networks</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowNotifications(true)} style={styles.logoutBtn}>
            <View>
                <Text style={{fontSize: 20}}>🔔</Text>
                {overdueCustomers.length > 0 && (
                    <View style={styles.notificationBadge}>
                        <Text style={styles.notificationBadgeText}>{overdueCustomers.length}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setIsDarkMode(!isDarkMode)} style={styles.logoutBtn}>
            <Text style={{fontSize: 20}}>{isDarkMode ? '☀️' : '🌙'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Main Content */}
      <View style={[styles.content, isDarkMode && styles.darkContainer]}>
        {renderContent()}
      </View>

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, isDarkMode && styles.darkHeader, isDarkMode && { borderTopColor: '#374151' }]}>
        {[
            { id: 'cable', icon: '📺', label: 'Cable' },
            { id: 'internet', icon: '🌐', label: 'Net' },
            { id: 'packages', icon: '📦', label: 'Pkgs' },
            { id: 'reports', icon: '📊', label: 'Stats' },
            { id: 'settings', icon: '⚙️', label: 'Set' },
            { id: 'profile', icon: '👤', label: 'Me' }
        ].map((tab) => (
            <TouchableOpacity 
              key={tab.id} 
              style={styles.bottomNavItem}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <Text style={{fontSize: 20, opacity: activeTab === tab.id ? 1 : 0.5}}>{tab.icon}</Text>
              <Text style={[styles.bottomNavText, activeTab === tab.id && styles.bottomNavTextActive, isDarkMode && activeTab !== tab.id && styles.darkSubText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
      </View>

      {/* Floating Action Button */}
      {((activeTab === 'packages') || 
        ((activeTab === 'cable' || activeTab === 'internet')) ||
        (activeTab === 'reports')) && !isSelectionMode && (
        <>
        {fabOpen && (
            <TouchableOpacity 
                style={[StyleSheet.absoluteFill, { zIndex: 99 }]} 
                activeOpacity={1} 
                onPress={() => setFabOpen(false)}
            >
                <View style={[StyleSheet.absoluteFill, { backgroundColor: isDarkMode ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.5)' }]} />
            </TouchableOpacity>
        )}
        <View style={styles.fabContainer} pointerEvents="box-none">
            <Animated.View style={[styles.fabMenu, {
              opacity: fabAnim,
              transform: [
                { scale: fabAnim },
                { translateY: fabAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }
              ]
            }]} pointerEvents={fabOpen ? 'auto' : 'none'}>
              {activeTab === 'packages' && activePackageSubTab === 'packages' && (
              <TouchableOpacity 
                style={[styles.fabMenuItem, isDarkMode && styles.darkCard]} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFabOpen(false);
                  setPkgName('');
                  setPkgPrice('');
                  setPkgMyProfit('');
                  setPkgFeatures('');
                  setPkgType('cable');
                  setPkgActive(true);
                  setEditingPackageId(null);
                  setPackageModalVisible(true);
                }}
              >
                <Text style={[styles.fabMenuItemText, isDarkMode && styles.darkText]}>Add Package</Text>
                <View style={[styles.fabMenuIcon, {backgroundColor: '#10b981'}]}>
                  <Text style={{fontSize: 16}}>📦</Text>
                </View>
              </TouchableOpacity>
              )}
              
              {activeTab === 'packages' && activePackageSubTab === 'bundles' && (
              <TouchableOpacity 
                style={[styles.fabMenuItem, isDarkMode && styles.darkCard]} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFabOpen(false);
                  setNewBundleName('');
                  setNewBundleItems([]);
                  setEditingBundleId(null);
                  setBundleModalVisible(true);
                }}
              >
                <Text style={[styles.fabMenuItemText, isDarkMode && styles.darkText]}>Add Bundle</Text>
                <View style={[styles.fabMenuIcon, {backgroundColor: '#10b981'}]}>
                  <Text style={{fontSize: 16}}>🎁</Text>
                </View>
              </TouchableOpacity>
              )}
              
              {activeTab === 'reports' && (
              <TouchableOpacity 
                style={[styles.fabMenuItem, isDarkMode && styles.darkCard]} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFabOpen(false);
                  setReportModalVisible(true);
                }}
              >
                <Text style={[styles.fabMenuItemText, isDarkMode && styles.darkText]}>Quick Report</Text>
                <View style={[styles.fabMenuIcon, {backgroundColor: '#8b5cf6'}]}>
                  <Text style={{fontSize: 16}}>📊</Text>
                </View>
              </TouchableOpacity>
              )}

              {(activeTab === 'cable' || activeTab === 'internet') && (
              <TouchableOpacity 
                style={[styles.fabMenuItem, isDarkMode && styles.darkCard]} 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFabOpen(false);
                  setEditingId(null); 
                  setNewName(''); 
                  setNewPackage(''); 
                  setNewAddress(''); 
                  setNewLastRecharge(''); 
                  setNewBoxNumber(''); 
                  setNewMacAddress(''); 
                  setNewMobile(''); 
                  setNewStatus('unpaid'); 
                  setNewExcludeFromReset(false);
                  setNewType(activeTab === 'internet' ? 'internet' : 'cable');
                  setModalVisible(true); 
                }}
              >
                <Text style={[styles.fabMenuItemText, isDarkMode && styles.darkText]}>Add Customer</Text>
                <View style={[styles.fabMenuIcon, {backgroundColor: '#2563eb'}]}>
                  <Text style={{fontSize: 16}}>👤</Text>
                </View>
              </TouchableOpacity>
              )}
            </Animated.View>
          <TouchableOpacity 
            style={[styles.fabMain, fabOpen ? {backgroundColor: '#ef4444'} : {backgroundColor: '#2563eb'}]} 
            onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                setFabOpen(!fabOpen);
            }}
          >
            <Animated.Text style={{
              fontSize: 24, 
              color: 'white', 
              fontWeight: 'bold',
              transform: [{ rotate: fabAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }]
            }}>+</Animated.Text>
          </TouchableOpacity>
        </View>
        </>
      )}

      {/* Add Modal */}
      <Modal visible={modalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>{editingId ? 'Edit Customer' : 'Add New Customer'}</Text>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Name</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="Customer Name" value={newName} onChangeText={setNewName} />
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Service Type</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: newType === 'cable' ? '#e0f2fe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        newType === 'cable' && { borderColor: '#0284c7', borderWidth: 1 }
                    ]} 
                    onPress={() => setNewType('cable')}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: newType === 'cable' ? '#0369a1' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Cable</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: newType === 'internet' ? '#e0f2fe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        newType === 'internet' && { borderColor: '#0284c7', borderWidth: 1 }
                    ]} 
                    onPress={() => setNewType('internet')}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: newType === 'internet' ? '#0369a1' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Internet</Text>
                </TouchableOpacity>
            </View>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Packages</Text>
            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10}}>
                {newPackage ? newPackage.split(',').map(p => p.trim()).filter(p => p).map((pkg, index) => (
                    <View key={index} style={{
                        flexDirection: 'row', 
                        alignItems: 'center', 
                        backgroundColor: isDarkMode ? '#374151' : '#e0f2fe', 
                        borderRadius: 16, 
                        paddingVertical: 6, 
                        paddingHorizontal: 12,
                        borderWidth: 1,
                        borderColor: isDarkMode ? '#4b5563' : '#bae6fd'
                    }}>
                        <Text style={{color: isDarkMode ? '#f3f4f6' : '#0369a1', marginRight: 6, fontSize: 14}}>{pkg}</Text>
                        <TouchableOpacity onPress={() => {
                            const current = newPackage.split(',').map(s => s.trim()).filter(s => s);
                            const updated = current.filter(c => c !== pkg);
                            setNewPackage(updated.join(', '));
                        }}>
                            <Text style={{color: isDarkMode ? '#9ca3af' : '#0284c7', fontWeight: 'bold', fontSize: 16}}>×</Text>
                        </TouchableOpacity>
                    </View>
                )) : (
                    <Text style={{color: isDarkMode ? '#9ca3af' : '#6b7280', fontStyle: 'italic', fontSize: 14, paddingVertical: 5}}>No packages selected</Text>
                )}
            </View>
            <TouchableOpacity 
              style={[styles.btnSecondary, { marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? '#4b5563' : '#d1d5db', backgroundColor: isDarkMode ? 'transparent' : 'white' }, isDarkMode && {backgroundColor: 'transparent'}]} 
              onPress={() => setShowPackagePicker(true)}
            >
              <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>+ Add / Remove Packages</Text>
            </TouchableOpacity>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Address</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="Address" value={newAddress} onChangeText={setNewAddress} />

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Mobile Number</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="Mobile Number" value={newMobile} onChangeText={setNewMobile} keyboardType="phone-pad" maxLength={10} />
            
            {newType === 'cable' ? (
                <>
                    <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Box Number</Text>
                    <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="Box Number" value={newBoxNumber} onChangeText={setNewBoxNumber} />
                </>
            ) : (
                <>
                    <Text style={[styles.label, isDarkMode && styles.darkLabel]}>MAC Address</Text>
                    <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="MAC Address" value={newMacAddress} onChangeText={setNewMacAddress} />
                </>
            )}

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Last Recharge</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput 
                    style={[styles.input, isDarkMode && styles.darkInput, { flex: 1 }]} 
                    placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} 
                    placeholder="YYYY-MM-DD" 
                    value={newLastRecharge} 
                    onChangeText={setNewLastRecharge} 
                />
                <TouchableOpacity style={[styles.btnSecondary, { justifyContent: 'center', paddingHorizontal: 15 }, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setNewLastRecharge(new Date().toISOString().split('T')[0])}>
                    <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Today</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: newStatus === 'paid' ? '#d1fae5' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        newStatus === 'paid' && { borderColor: '#10b981', borderWidth: 1 }
                    ]} 
                    onPress={() => setNewStatus('paid')}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: newStatus === 'paid' ? '#065f46' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Paid</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: newStatus === 'unpaid' ? '#fee2e2' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        newStatus === 'unpaid' && { borderColor: '#ef4444', borderWidth: 1 }
                    ]} 
                    onPress={() => setNewStatus('unpaid')}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: newStatus === 'unpaid' ? '#991b1b' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Unpaid</Text>
                </TouchableOpacity>
            </View>

            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
                <Text style={[styles.label, {marginBottom: 0}, isDarkMode && styles.darkLabel]}>Exclude from Monthly Reset</Text>
                <Switch
                    value={newExcludeFromReset}
                    onValueChange={setNewExcludeFromReset}
                    trackColor={{ false: "#767577", true: "#93c5fd" }}
                    thumbColor={newExcludeFromReset ? "#2563eb" : "#f4f3f4"}
                />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => { setModalVisible(false); setEditingId(null); setNewName(''); setNewPackage(''); setNewAddress(''); setNewLastRecharge(''); setNewBoxNumber(''); setNewMacAddress(''); setNewMobile(''); setNewStatus('unpaid'); setNewExcludeFromReset(false); }}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveCustomer}>
                <Text style={styles.btnText}>{editingId ? 'Update' : 'Save'} Customer</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Package Picker Modal */}
      <Modal visible={showPackagePicker} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Select Package</Text>
            
            <TextInput 
              style={[styles.searchInput, isDarkMode && styles.darkInput, { marginBottom: 10 }]}
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              placeholder="Search packages..."
              value={packagePickerSearchQuery}
              onChangeText={setPackagePickerSearchQuery}
            />

            <View style={{flexDirection: 'row', marginBottom: 15, backgroundColor: isDarkMode ? '#374151' : '#f3f4f6', borderRadius: 8, padding: 4}}>
                <TouchableOpacity onPress={() => setPickerMode('packages')} style={{flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: pickerMode === 'packages' ? (isDarkMode ? '#4b5563' : 'white') : 'transparent'}}>
                    <Text style={{fontWeight: '600', color: isDarkMode ? '#f9fafb' : '#374151'}}>Individual</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setPickerMode('bundles')} style={{flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6, backgroundColor: pickerMode === 'bundles' ? (isDarkMode ? '#4b5563' : 'white') : 'transparent'}}>
                    <Text style={{fontWeight: '600', color: isDarkMode ? '#f9fafb' : '#374151'}}>Bundles</Text>
                </TouchableOpacity>
            </View>

            {pickerMode === 'packages' ? (
            <FlatList
              data={packages.filter(p => (p.type?.toLowerCase() === (newType === 'internet' ? 'internet' : 'cable')) && p.active && p.name.toLowerCase().includes(packagePickerSearchQuery.toLowerCase()))}
              keyExtractor={item => item.id}
              renderItem={({ item }) => {
                const selectedPackages = newPackage ? newPackage.split(',').map(s => s.trim()) : [];
                const isSelected = selectedPackages.includes(item.name);
                return (
                <TouchableOpacity 
                  style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                  onPress={() => {
                    let updated;
                    if (isSelected) updated = selectedPackages.filter(p => p !== item.name);
                    else updated = [...selectedPackages, item.name];
                    setNewPackage(updated.join(', '));
                  }}
                >
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                    <View>
                        <Text style={[isDarkMode && styles.darkText, { fontSize: 16, fontWeight: '500' }]}>{item.name} - {item.price}</Text>
                        <Text style={{ fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>{item.features}</Text>
                    </View>
                    {isSelected && <Text style={{color: '#2563eb', fontWeight: 'bold', fontSize: 18}}>✓</Text>}
                  </View>
                </TouchableOpacity>
              )}}
              ListEmptyComponent={
                <View style={{ padding: 20, alignItems: 'center' }}>
                    <Text style={{ textAlign: 'center', color: isDarkMode ? '#9ca3af' : '#6b7280', marginBottom: 10 }}>No active packages found for {newType}.</Text>
                    <TouchableOpacity onPress={() => { setShowPackagePicker(false); setPackagePickerSearchQuery(''); setModalVisible(false); setActiveTab('packages'); }}>
                        <Text style={{ color: '#2563eb', fontWeight: 'bold' }}>Go to Packages Tab to add one</Text>
                    </TouchableOpacity>
                </View>
              }
            />
            ) : (
                <FlatList
                data={bundles.filter(b => b.name.toLowerCase().includes(packagePickerSearchQuery.toLowerCase()))}
                keyExtractor={item => item.id}
                renderItem={({ item }) => {
                    const bundleItems = item.items.split(',').map(s => s.trim());
                    const totalPrice = bundleItems.reduce((sum, name) => {
                        const pkg = packages.find(p => p.name.trim().toLowerCase() === name.toLowerCase());
                        return sum + (pkg ? (parseFloat(pkg.price.replace(/[^0-9.]/g, '')) || 0) : 0);
                    }, 0);
                    
                    return (
                    <TouchableOpacity 
                    style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb' }}
                    onPress={() => {
                        setNewPackage(item.items);
                        setShowPackagePicker(false);
                        setPackagePickerSearchQuery('');
                    }}
                    >
                    <View>
                        <Text style={[isDarkMode && styles.darkText, { fontSize: 16, fontWeight: '500' }]}>{item.name} - ₹{totalPrice.toFixed(2)}</Text>
                        <Text style={{ fontSize: 12, color: isDarkMode ? '#9ca3af' : '#6b7280', marginTop: 2 }}>{item.items}</Text>
                    </View>
                    </TouchableOpacity>
                )}}
                ListEmptyComponent={<Text style={{textAlign: 'center', padding: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>No bundles available.</Text>}
                />
            )}
            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 15 }]} onPress={() => { setShowPackagePicker(false); setPackagePickerSearchQuery(''); }}>
              <Text style={styles.btnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History Modal */}
      <Modal visible={historyModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                <Text style={[styles.modalTitle, {marginBottom: 0}, isDarkMode && styles.darkText]}>History: {historyCustomerName}</Text>
                <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                    <Text style={{fontSize: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>✕</Text>
                </TouchableOpacity>
            </View>
            
            <FlatList
              data={customerHistory}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{ borderLeftWidth: 2, borderLeftColor: '#2563eb', paddingLeft: 15, marginBottom: 20 }}>
                    <Text style={[isDarkMode && styles.darkText, {fontWeight: 'bold', fontSize: 16}]}>{item.action}</Text>
                    <Text style={[isDarkMode && styles.darkSubText, {fontSize: 14, marginTop: 2}]}>{item.details}</Text>
                    <Text style={{fontSize: 12, color: isDarkMode ? '#6b7280' : '#9ca3af', marginTop: 4}}>{new Date(item.timestamp).toLocaleString()}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={{textAlign: 'center', padding: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>No history available.</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Add Package Modal */}
      <Modal visible={packageModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>{editingPackageId ? 'Edit Package' : 'Add New Package'}</Text>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Package Name</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="e.g. Basic Plan" value={pkgName} onChangeText={setPkgName} />
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Price</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="e.g. 29.99" value={pkgPrice} onChangeText={setPkgPrice} keyboardType="numeric" />
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>My Profit</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="e.g. 10.00" value={pkgMyProfit} onChangeText={setPkgMyProfit} keyboardType="numeric" />

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Features</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="e.g. 50 Mbps / 100 Channels" value={pkgFeatures} onChangeText={setPkgFeatures} />

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Type</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: pkgType === 'cable' ? '#e0f2fe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        pkgType === 'cable' && { borderColor: '#0284c7', borderWidth: 1 }
                    ]} 
                    onPress={() => setPkgType('cable')}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: pkgType === 'cable' ? '#0369a1' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Cable</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: pkgType === 'internet' ? '#e0f2fe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        pkgType === 'internet' && { borderColor: '#0284c7', borderWidth: 1 }
                    ]} 
                    onPress={() => setPkgType('internet')}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: pkgType === 'internet' ? '#0369a1' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Internet</Text>
                </TouchableOpacity>
            </View>

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Status</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: pkgActive ? '#d1fae5' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        pkgActive && { borderColor: '#10b981', borderWidth: 1 }
                    ]} 
                    onPress={() => setPkgActive(true)}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: pkgActive ? '#065f46' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Active</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[
                        styles.statusBtn, 
                        { backgroundColor: !pkgActive ? '#fee2e2' : (isDarkMode ? '#374151' : '#f3f4f6') },
                        !pkgActive && { borderColor: '#ef4444', borderWidth: 1 }
                    ]} 
                    onPress={() => setPkgActive(false)}
                >
                    <Text style={[
                        styles.statusBtnText, 
                        { color: !pkgActive ? '#991b1b' : (isDarkMode ? '#9ca3af' : '#4b5563') }
                    ]}>Inactive</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => { setPackageModalVisible(false); setEditingPackageId(null); setPkgActive(true); }}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSavePackage}>
                <Text style={styles.btnText}>{editingPackageId ? 'Update' : 'Save'} Package</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Bundle Modal */}
      <Modal visible={bundleModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, {maxHeight: '80%'}]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>{editingBundleId ? 'Edit Bundle' : 'Create New Bundle'}</Text>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Bundle Name</Text>
            <TextInput style={[styles.input, isDarkMode && styles.darkInput]} placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'} placeholder="e.g. Super Saver Combo" value={newBundleName} onChangeText={setNewBundleName} />
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Select Packages</Text>
            <FlatList
                data={packages.filter(p => p.active)}
                keyExtractor={item => item.id}
                style={{maxHeight: 300, marginBottom: 15, borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#e5e7eb', borderRadius: 8}}
                renderItem={({ item }) => {
                    const isSelected = newBundleItems.includes(item.name);
                    return (
                        <TouchableOpacity 
                            style={{padding: 12, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: isSelected ? (isDarkMode ? '#374151' : '#eff6ff') : 'transparent'}}
                            onPress={() => {
                                if (isSelected) setNewBundleItems(prev => prev.filter(i => i !== item.name));
                                else setNewBundleItems(prev => [...prev, item.name]);
                            }}
                        >
                            <Text style={[isDarkMode && styles.darkText]}>{item.name} ({item.price})</Text>
                            {isSelected && <Text style={{color: '#2563eb', fontWeight: 'bold'}}>✓</Text>}
                        </TouchableOpacity>
                    );
                }}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => { setBundleModalVisible(false); setEditingBundleId(null); setNewBundleName(''); setNewBundleItems([]); }}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveBundle}>
                <Text style={styles.btnText}>{editingBundleId ? 'Update Bundle' : 'Save Bundle'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear Data Authentication Modal */}
      <Modal visible={clearDataModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Authentication Required</Text>
            <Text style={[styles.label, {marginBottom: 20, fontWeight: 'normal'}, isDarkMode && styles.darkSubText]}>
              Please enter your password to confirm clearing all data. This action cannot be undone.
            </Text>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Password</Text>
            <TextInput 
                style={[styles.input, isDarkMode && styles.darkInput]} 
                placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                secureTextEntry
                placeholder="Enter Admin Password"
                value={authPassword}
                onChangeText={setAuthPassword}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setClearDataModalVisible(false)}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#ef4444'}]} onPress={confirmClearData}>
                <Text style={styles.btnText}>Confirm Clear</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* View Mode Picker Modal */}
      <Modal visible={showViewOptions} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxWidth: 300 }]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Select View Mode</Text>
            {['list', 'grid', 'detail'].map((mode) => (
                <TouchableOpacity 
                    key={mode}
                    style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between' }}
                    onPress={() => {
                        setViewMode(mode as any);
                        setShowViewOptions(false);
                    }}
                >
                    <Text style={[isDarkMode && styles.darkText, { fontSize: 16, textTransform: 'capitalize' }]}>{mode} View</Text>
                    {viewMode === mode && <Text style={{color: '#2563eb'}}>✓</Text>}
                </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.btnSecondary, { marginTop: 15 }, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setShowViewOptions(false)}>
              <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Sort Options Modal */}
      <Modal visible={showSortOptions} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxWidth: 300 }]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Sort By</Text>
            {[
                { label: 'Name', value: 'name' },
                { label: 'Box Number', value: 'boxNumber' },
                { label: 'Address', value: 'address' },
                { label: 'Mobile Number', value: 'mobile' },
                { label: 'Package', value: 'package' },
                { label: 'Last Recharge', value: 'lastRecharge' }
            ].map((option) => (
                <TouchableOpacity 
                    key={option.value}
                    style={{ paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#374151' : '#e5e7eb', flexDirection: 'row', justifyContent: 'space-between' }}
                    onPress={() => {
                        if (sortBy === option.value) {
                            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                            setSortBy(option.value as any);
                            setSortOrder('asc');
                        }
                        setShowSortOptions(false);
                    }}
                >
                    <Text style={[isDarkMode && styles.darkText, { fontSize: 16 }]}>{option.label}</Text>
                    {sortBy === option.value && <Text style={{color: '#2563eb'}}>{sortOrder === 'asc' ? '↑' : '↓'}</Text>}
                </TouchableOpacity>
            ))}
            <TouchableOpacity style={[styles.btnSecondary, { marginTop: 15 }, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setShowSortOptions(false)}>
              <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Recycle Bin Modal */}
      <Modal visible={recycleBinModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                <Text style={[styles.modalTitle, {marginBottom: 0}, isDarkMode && styles.darkText]}>Recycle Bin</Text>
                <TouchableOpacity onPress={() => setRecycleBinModalVisible(false)}>
                    <Text style={{fontSize: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>✕</Text>
                </TouchableOpacity>
            </View>
            
            <TextInput 
              style={[styles.searchInput, isDarkMode && styles.darkInput, { marginBottom: 15 }]}
              placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
              placeholder="Search deleted customers..."
              value={recycleBinSearchQuery}
              onChangeText={setRecycleBinSearchQuery}
            />

            <FlatList
              data={deletedCustomers.filter(c => c.name.toLowerCase().includes(recycleBinSearchQuery.toLowerCase()) || c.address.toLowerCase().includes(recycleBinSearchQuery.toLowerCase()) || (c.mobile && c.mobile.includes(recycleBinSearchQuery)))}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={[styles.card, isDarkMode && styles.darkCard, {borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#e5e7eb'}]}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.cardTitle, {fontSize: 16}, isDarkMode && styles.darkText]}>{item.name}</Text>
                    <Text style={[styles.cardValue, {fontSize: 12}, isDarkMode && styles.darkSubText]}>{item.type.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.cardValue, {marginBottom: 10}, isDarkMode && styles.darkText]}>{item.package} • {item.address}</Text>
                  <View style={{flexDirection: 'row', justifyContent: 'flex-end', gap: 10}}>
                    <TouchableOpacity style={[styles.btnEdit, {marginRight: 0}]} onPress={() => handleRestoreCustomer(item.id)}>
                        <Text style={styles.btnEditText}>Restore</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.btnDelete]} onPress={() => handlePermanentDelete(item.id)}>
                        <Text style={styles.btnDeleteText}>Delete Forever</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{textAlign: 'center', padding: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>Recycle bin is empty.</Text>}
            />
            
            {deletedCustomers.length > 0 && (
                <TouchableOpacity style={[styles.btnDelete, {marginTop: 15, alignItems: 'center'}]} onPress={handleEmptyRecycleBin}>
                    <Text style={styles.btnDeleteText}>Empty Recycle Bin</Text>
                </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>

      {/* Restore Backup Modal */}
      <Modal visible={restoreModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '80%' }]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Restore Database</Text>
            <Text style={[styles.label, {marginBottom: 15, fontWeight: 'normal'}, isDarkMode && styles.darkSubText]}>
              Paste the content of your backup CSV (or JSON) file below.
            </Text>
            
            <TextInput 
                style={[styles.input, isDarkMode && styles.darkInput, { height: 200, textAlignVertical: 'top' }]} 
                placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                multiline
                placeholder="id,name,package,status..."
                value={restoreDataString}
                onChangeText={setRestoreDataString}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setRestoreModalVisible(false)}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.btnPrimary, {backgroundColor: '#ef4444'}]} onPress={performRestore}>
                <Text style={styles.btnText}>Restore Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reset History Modal */}
      <Modal visible={resetHistoryModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                <Text style={[styles.modalTitle, {marginBottom: 0}, isDarkMode && styles.darkText]}>Monthly Reset Log</Text>
                <TouchableOpacity onPress={() => setResetHistoryModalVisible(false)}>
                    <Text style={{fontSize: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>✕</Text>
                </TouchableOpacity>
            </View>
            
            <FlatList
              data={resetHistory}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={{ borderLeftWidth: 2, borderLeftColor: '#e67e22', paddingLeft: 15, marginBottom: 15 }}>
                    <Text style={[isDarkMode && styles.darkText, {fontWeight: 'bold', fontSize: 14}]}>
                        {item.customers?.name || 'Unknown Customer'}
                    </Text>
                    <Text style={[isDarkMode && styles.darkSubText, {fontSize: 12, marginTop: 2}]}>{item.details}</Text>
                    <Text style={{fontSize: 10, color: isDarkMode ? '#6b7280' : '#9ca3af', marginTop: 2}}>{new Date(item.timestamp).toLocaleString()}</Text>
                </View>
              )}
              ListEmptyComponent={<Text style={{textAlign: 'center', padding: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>No reset history found.</Text>}
            />
          </View>
        </View>
      </Modal>

      {/* Report Generation Modal */}
      <Modal visible={reportModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Generate Report</Text>
            <Text style={[styles.label, {marginBottom: 15, fontWeight: 'normal'}, isDarkMode && styles.darkSubText]}>
              Select a date range to filter the report by Last Recharge date. Leave blank for all time.
            </Text>
            
            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Filter by Status</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                {(['all', 'paid', 'unpaid'] as const).map(status => (
                    <TouchableOpacity 
                        key={status}
                        style={[
                            styles.statusBtn, 
                            { backgroundColor: reportStatusFilter === status ? '#dbeafe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                            reportStatusFilter === status && { borderColor: '#2563eb', borderWidth: 1 }
                        ]}
                        onPress={() => setReportStatusFilter(status)}
                    >
                        <Text style={[styles.statusBtnText, {color: reportStatusFilter === status ? '#1e40af' : (isDarkMode ? '#9ca3af' : '#4b5563'), textTransform: 'capitalize'}]}>{status}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Filter by Type</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                {(['all', 'cable', 'internet'] as const).map(type => (
                    <TouchableOpacity 
                        key={type}
                        style={[
                            styles.statusBtn, 
                            { backgroundColor: reportTypeFilter === type ? '#dbeafe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                            reportTypeFilter === type && { borderColor: '#2563eb', borderWidth: 1 }
                        ]}
                        onPress={() => setReportTypeFilter(type)}
                    >
                        <Text style={[styles.statusBtnText, {color: reportTypeFilter === type ? '#1e40af' : (isDarkMode ? '#9ca3af' : '#4b5563'), textTransform: 'capitalize'}]}>{type}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                <View style={{flex: 1}}>
                    <Text style={[styles.label, isDarkMode && styles.darkLabel]}>Start Date</Text>
                    <TextInput 
                        style={[styles.input, isDarkMode && styles.darkInput]} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                        value={reportStartDate} 
                        onChangeText={setReportStartDate} 
                    />
                </View>
                <View style={{flex: 1}}>
                    <Text style={[styles.label, isDarkMode && styles.darkLabel]}>End Date</Text>
                    <TextInput 
                        style={[styles.input, isDarkMode && styles.darkInput]} 
                        placeholder="YYYY-MM-DD" 
                        placeholderTextColor={isDarkMode ? '#9ca3af' : '#6b7280'}
                        value={reportEndDate} 
                        onChangeText={setReportEndDate} 
                    />
                </View>
            </View>

            <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
                <TouchableOpacity style={[styles.filterBtn, isDarkMode && styles.darkFilterBtn]} onPress={() => {
                    const today = new Date();
                    const thirtyDaysAgo = new Date(today.setDate(today.getDate() - 30)).toISOString().split('T')[0];
                    setReportStartDate(thirtyDaysAgo);
                    setReportEndDate(new Date().toISOString().split('T')[0]);
                }}>
                    <Text style={[styles.filterBtnText, isDarkMode && styles.darkSubText]}>Last 30 Days</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterBtn, isDarkMode && styles.darkFilterBtn]} onPress={() => {
                    const date = new Date();
                    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
                    setReportStartDate(firstDay);
                    setReportEndDate(new Date().toISOString().split('T')[0]);
                }}>
                    <Text style={[styles.filterBtnText, isDarkMode && styles.darkSubText]}>This Month</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.filterBtn, isDarkMode && styles.darkFilterBtn]} onPress={() => {
                    setReportStartDate('');
                    setReportEndDate('');
                }}>
                    <Text style={[styles.filterBtnText, isDarkMode && styles.darkSubText]}>Clear</Text>
                </TouchableOpacity>
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setReportModalVisible(false)}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={() => { setReportModalVisible(false); handleQuickReport(); }}>
                <Text style={styles.btnText}>Generate PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cloud Backup Name Modal */}
      <Modal visible={cloudBackupModalVisible} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard]}>
            <Text style={[styles.modalTitle, isDarkMode && styles.darkText]}>Name Your Backup</Text>
            <TextInput 
                style={[styles.input, isDarkMode && styles.darkInput]} 
                placeholder="e.g. Before Major Update" 
                value={newBackupName} 
                onChangeText={setNewBackupName} 
            />
            
            <Text style={[styles.label, {marginTop: 15}, isDarkMode && styles.darkLabel]}>Backup Scope</Text>
            <View style={{flexDirection: 'row', gap: 10, marginBottom: 15}}>
                {(['all', 'cable', 'internet'] as const).map(scope => (
                    <TouchableOpacity 
                        key={scope}
                        style={[
                            styles.statusBtn, 
                            { backgroundColor: backupScope === scope ? '#dbeafe' : (isDarkMode ? '#374151' : '#f3f4f6') },
                            backupScope === scope && { borderColor: '#2563eb', borderWidth: 1 }
                        ]}
                        onPress={() => setBackupScope(scope)}
                    >
                        <Text style={[styles.statusBtnText, {color: backupScope === scope ? '#1e40af' : (isDarkMode ? '#9ca3af' : '#4b5563'), textTransform: 'capitalize'}]}>{scope}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.btnSecondary, isDarkMode && {backgroundColor: '#374151'}]} onPress={() => setCloudBackupModalVisible(false)}>
                <Text style={[styles.btnTextSecondary, isDarkMode && styles.darkText]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSaveCloudBackup}>
                <Text style={styles.btnText}>Save Backup</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Notifications Modal */}
      <Modal visible={showNotifications} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isDarkMode && styles.darkCard, { maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
                <Text style={[styles.modalTitle, {marginBottom: 0}, isDarkMode && styles.darkText]}>Notifications</Text>
                <TouchableOpacity onPress={() => setShowNotifications(false)}>
                    <Text style={{fontSize: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>✕</Text>
                </TouchableOpacity>
            </View>
            
            {overdueCustomers.length > 0 && (
                <TouchableOpacity style={[styles.btnPrimary, { marginBottom: 15, backgroundColor: '#e67e22' }]} onPress={handleBulkReminders}>
                    <Text style={styles.btnText}>📢 Send Bulk Reminders</Text>
                </TouchableOpacity>
            )}

            <FlatList
              data={overdueCustomers}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={[styles.card, isDarkMode && styles.darkCard, {borderWidth: 1, borderColor: isDarkMode ? '#374151' : '#e5e7eb', padding: 12}]}>
                  <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start'}}>
                      <View style={{flex: 1}}>
                        <Text style={[styles.cardTitle, {fontSize: 16}, isDarkMode && styles.darkText]}>Overdue Payment</Text>
                        <Text style={[styles.cardValue, {fontSize: 14, marginTop: 4}, isDarkMode && styles.darkText]}>
                            {item.name} ({item.package})
                        </Text>
                        <Text style={[styles.cardValue, {fontSize: 12, color: '#ef4444', marginTop: 2}]}>
                            Last Recharge: {item.lastRecharge || 'Unknown'}
                        </Text>
                      </View>
                      <TouchableOpacity style={[styles.btnShare, {marginRight: 0, backgroundColor: '#dbeafe'}]} onPress={() => handleShareInvoice(item)}>
                        <Text style={[styles.btnShareText, {color: '#2563eb'}]}>Remind</Text>
                      </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={<Text style={{textAlign: 'center', padding: 20, color: isDarkMode ? '#9ca3af' : '#6b7280'}}>No new notifications.</Text>}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default function Page() {
  const [view, setView] = useState<'home' | 'login' | 'admin'>('home');

  if (view === 'login') {
      return <LoginScreen onLogin={() => setView('admin')} onBack={() => setView('home')} />;
  }
  
  if (view === 'admin') {
      return <AdminPanel onLogout={() => setView('home')} />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.main}>
        <Text style={styles.title}>Hello World</Text>
        <Text style={styles.subtitle}>This is the first page of your app.</Text>
        <View style={styles.spacer} />
        <Button title="click me" onPress={() => setView('login')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Global
  container: {
    flex: 1,
    alignItems: "center",
    padding: 24,
    backgroundColor: '#f9fafb',
  },
  main: {
    flex: 1,
    justifyContent: "center",
    maxWidth: 960,
    marginHorizontal: "auto",
    alignItems: 'center',
  },
  title: {
    fontSize: 64,
    fontWeight: "bold",
    color: '#111827',
  },
  subtitle: {
    fontSize: 36,
    color: "#4b5563",
    textAlign: 'center',
  },
  spacer: {
      height: 20,
  },
  
  // Login Styles
  loginContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#f3f4f6',
      padding: 20,
  },
  loginCard: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: 'white',
      padding: 30,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
  },
  loginTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 5,
      textAlign: 'center',
  },
  loginSubtitle: {
      fontSize: 14,
      color: '#6b7280',
      marginBottom: 25,
      textAlign: 'center',
  },
  formGroup: {
      marginBottom: 15,
  },
  label: {
      fontSize: 14,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 5,
  },
  input: {
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      color: '#111827',
  },
  passwordContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#fff',
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 8,
      paddingHorizontal: 12,
  },
  passwordInput: {
      flex: 1,
      paddingVertical: 12,
      fontSize: 16,
      color: '#111827',
  },
  eyeIcon: {
      padding: 4,
  },
  btnPrimary: {
      backgroundColor: '#2563eb',
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      marginTop: 10,
  },
  btnSecondary: {
      backgroundColor: '#f3f4f6',
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
  },
  btnText: {
      color: 'white',
      fontWeight: '600',
      fontSize: 16,
  },
  btnTextSecondary: {
      color: '#374151',
      fontWeight: '600',
      fontSize: 16,
  },
  btnLink: {
      marginTop: 15,
      alignItems: 'center',
  },
  linkText: {
      color: '#2563eb',
      fontSize: 14,
  },
  rememberMeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 15,
  },
  checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#d1d5db',
      marginRight: 8,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'white',
  },
  checkboxChecked: {
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
  },
  checkboxCheck: {
      color: 'white',
      fontSize: 12,
      fontWeight: 'bold',
  },
  rememberMeText: {
      fontSize: 14,
      color: '#374151',
  },

  // Admin Styles
  adminContainer: {
      flex: 1,
      backgroundColor: '#f9fafb',
  },
  header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: 'white',
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
  },
  headerLogo: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#2563eb',
  },
  logoutBtn: {
      padding: 8,
  },
  logoutText: {
      color: '#ef4444',
      fontWeight: '600',
  },
  bottomNav: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      backgroundColor: 'white',
      borderTopWidth: 1,
      borderTopColor: '#e5e7eb',
      paddingVertical: 8,
  },
  bottomNavItem: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 4,
      flex: 1,
  },
  bottomNavText: {
      fontSize: 10,
      color: '#94a3b8',
      fontWeight: '600',
      marginTop: 2,
  },
  bottomNavTextActive: {
      color: '#2563eb',
  },
  content: {
      flex: 1,
      padding: 16,
  },
  sectionContainer: {
      flex: 1,
  },
  sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
  },
  sectionTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#111827',
  },
  btnAdd: {
      backgroundColor: '#2563eb',
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 6,
  },
  listContent: {
      paddingBottom: 20,
  },
  card: {
      backgroundColor: 'white',
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
  },
  cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 12,
  },
  cardTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: '#111827',
  },
  cardBody: {
      flexDirection: 'row',
      marginBottom: 4,
  },
  cardLabel: {
      width: 80,
      color: '#6b7280',
      fontSize: 14,
  },
  cardValue: {
      color: '#374151',
      fontSize: 14,
      flex: 1,
  },
  searchContainer: {
      marginBottom: 15,
  },
  searchInput: {
      backgroundColor: 'white',
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#d1d5db',
  },
  filterContainer: {
      flexDirection: 'row',
      marginTop: 10,
      gap: 8,
  },
  filterBtn: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 20,
      backgroundColor: '#e5e7eb',
  },
  filterBtnActive: {
      backgroundColor: '#2563eb',
  },
  filterBtnText: {
      fontSize: 12,
      color: '#4b5563',
      fontWeight: '600',
  },
  filterBtnTextActive: {
      color: 'white',
  },
  sortContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 10,
      gap: 8,
  },
  sortLabel: {
      fontSize: 12,
      color: '#6b7280',
      marginRight: 4,
  },
  sortBtn: {
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#d1d5db',
  },
  sortBtnActive: {
      backgroundColor: '#e0f2fe',
      borderColor: '#0284c7',
  },
  sortBtnText: {
      fontSize: 12,
      color: '#4b5563',
  },
  sortBtnTextActive: {
      color: '#0284c7',
      fontWeight: 'bold',
  },
  cardActions: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'flex-end',
      borderTopWidth: 1,
      borderTopColor: '#f3f4f6',
      paddingTop: 12,
  },
  btnDelete: {
      backgroundColor: '#fee2e2',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
  },
  btnDeleteText: {
      color: '#ef4444',
      fontSize: 12,
      fontWeight: 'bold',
  },
  btnEdit: {
      backgroundColor: '#e0f2fe',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginRight: 8,
  },
  btnEditText: {
      color: '#0284c7',
      fontSize: 12,
      fontWeight: 'bold',
  },
  badge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
  },
  badgeSuccess: {
      backgroundColor: '#d1fae5',
  },
  badgeDanger: {
      backgroundColor: '#fee2e2',
  },
  badgeText: {
      fontSize: 12,
      fontWeight: 'bold',
      textTransform: 'uppercase',
  },
  centerContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  placeholderText: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#9ca3af',
  },
  subPlaceholder: {
      fontSize: 16,
      color: '#d1d5db',
      marginTop: 8,
  },
  emptyState: {
      padding: 20,
      alignItems: 'center',
  },
  emptyText: {
      color: '#6b7280',
      fontStyle: 'italic',
  },
  
  // Modal
  modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
  },
  modalContent: {
      width: '100%',
      maxWidth: 500,
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
  },
  modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827',
      marginBottom: 20,
  },
  modalActions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      gap: 12,
      marginTop: 20,
  },

  // Reports
  reportsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
  },
  reportCard: {
      width: '48%',
      backgroundColor: 'white',
      borderRadius: 8,
      padding: 20,
      marginBottom: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 2,
  },
  reportLabel: {
      fontSize: 14,
      color: '#6b7280',
      marginBottom: 8,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
  },
  reportValue: {
      fontSize: 28,
      fontWeight: 'bold',
      color: '#111827',
  },

  // Profile
  profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 24,
  },
  avatarContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: '#2563eb',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
      overflow: 'hidden',
  },
  avatarImage: {
      width: '100%',
      height: '100%',
  },
  avatarText: {
      color: 'white',
      fontSize: 24,
      fontWeight: 'bold',
  },
  profileName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#111827',
  },
  profileRole: {
      color: '#6b7280',
      fontSize: 14,
  },
  divider: {
      height: 1,
      backgroundColor: '#e5e7eb',
      marginVertical: 20,
  },

  // Dark Mode
  darkContainer: { backgroundColor: '#111827' },
  darkHeader: { backgroundColor: '#1f2937', borderBottomColor: '#374151' },
  darkText: { color: '#f9fafb' },
  darkSubText: { color: '#9ca3af' },
  darkCard: { backgroundColor: '#1f2937', borderColor: '#374151' },
  darkInput: { backgroundColor: '#374151', color: '#f9fafb', borderColor: '#4b5563' },
  darkLabel: { color: '#d1d5db' },
  darkFilterBtn: { backgroundColor: '#374151' },
  statusBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
  },
  statusBtnText: {
      fontWeight: 'bold',
      fontSize: 14,
  },
  btnShare: {
      backgroundColor: '#f3e8ff',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      marginRight: 8,
  },
  btnShareText: {
      color: '#7e22ce',
      fontSize: 12,
      fontWeight: 'bold',
  },
  notificationBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#ef4444',
      borderRadius: 10,
      width: 18,
      height: 18,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'white',
  },
  notificationBadgeText: {
      color: 'white',
      fontSize: 10,
      fontWeight: 'bold',
  },
  fabContainer: {
    position: 'absolute',
    bottom: 80, // Above bottom nav
    right: 20,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  fabMain: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  fabMenu: {
    marginBottom: 10,
    alignItems: 'flex-end',
    gap: 10,
  },
  fabMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  fabMenuItemText: {
    marginRight: 10,
    fontWeight: '600',
    color: '#374151',
  },
  fabMenuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bulkActionBar: {
      position: 'absolute',
      bottom: 20,
      left: 20,
      right: 20,
      backgroundColor: 'white',
      borderRadius: 12,
      padding: 15,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 4,
      elevation: 5,
      zIndex: 100,
  },
  bulkActionText: {
      fontWeight: 'bold',
      fontSize: 16,
      color: '#111827',
  },
});
