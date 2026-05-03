import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, Dimensions, Animated, Vibration
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import RazorpayCheckout from 'react-native-razorpay';
import axios from 'axios';
import AuthContext from '../context/AuthContext';
import API_URL from '../utils/api';
import { useToast } from '../context/ToastContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PricingScreen({ navigation }: any) {
  const { theme, accentColor, isDarkMode } = useTheme();
  const dynamicStyles = getStyles(theme, accentColor, isDarkMode);
  const auth = useContext(AuthContext);
  const { showToast } = useToast();

  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const resp = await axios.get(`${API_URL}/api/payments/plans`);
      setPlans(resp.data);
    } catch (err) {
      showToast('Failed to load plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (planId: string) => {
    if (!auth.token) {
      showToast('Please login to upgrade', 'info');
      return;
    }
    setProcessing(planId);
    Vibration.vibrate(50);

    try {
      // 1. Create Razorpay Order on Backend
      const orderResp = await axios.post(`${API_URL}/api/payments/create-session`, 
        { planId },
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );
      
      const { orderId, amount, currency, keyId } = orderResp.data;

      // 2. Open Razorpay Checkout
      // Note: You must run `npm install react-native-razorpay` and link it
      // import RazorpayCheckout from 'react-native-razorpay';
      
      const options = {
        description: `Upgrade to ${planId.toUpperCase()}`,
        image: 'https://i.imgur.com/399S81S.png', // App Logo
        currency: currency,
        key: keyId,
        amount: amount,
        name: 'Syncognito',
        order_id: orderId,
        prefill: {
          email: auth.user?.email || '',
          name: auth.user?.name || '',
          contact: '9876543210'
        },
        theme: { color: accentColor }
      };

      // 3. Open Razorpay Checkout
      showToast('Opening Razorpay Gateway...', 'info');
      
      RazorpayCheckout.open(options).then(async (data: any) => {
        try {
          // 4. Verify Signature on Backend
          const verifyResp = await axios.post(`${API_URL}/api/payments/verify-signature`, {
            razorpay_payment_id: data.razorpay_payment_id,
            razorpay_order_id: data.razorpay_order_id,
            razorpay_signature: data.razorpay_signature,
            planId
          }, { headers: { Authorization: `Bearer ${auth.token}` } });

          if (verifyResp.data.success) {
            Vibration.vibrate([0, 100, 50, 100]);
            showToast('Welcome to Premium! 🎉', 'success');
            if (auth.refreshProfile) await auth.refreshProfile();
            navigation.goBack();
          }
        } catch (err) {
          showToast('Payment verification failed', 'error');
        } finally {
          setProcessing(null);
        }
      }).catch((error: any) => {
        showToast(error.description || 'Payment cancelled', 'error');
        setProcessing(null);
      });

    } catch (err) {
      showToast('Failed to initialize Razorpay', 'error');
      setProcessing(null);
    }
  };

  if (loading) {
    return (
      <View style={[dynamicStyles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={accentColor} />
      </View>
    );
  }

  return (
    <ScrollView style={dynamicStyles.container} contentContainerStyle={dynamicStyles.content}>
      <View style={dynamicStyles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={dynamicStyles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={30} color={theme.text} />
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>Premium Plans</Text>
      </View>

      <View style={dynamicStyles.heroSection}>
        <LinearGradient colors={[accentColor, '#8A2BE2']} style={dynamicStyles.heroGradient} start={{x:0, y:0}} end={{x:1, y:1}}>
           <MaterialCommunityIcons name="crown" size={60} color="#FFF" style={dynamicStyles.heroIcon} />
           <Text style={dynamicStyles.heroTitle}>Level Up Your Experience</Text>
           <Text style={dynamicStyles.heroSub}>Choose a plan that fits your social and musical vibe.</Text>
        </LinearGradient>
      </View>

      <View style={dynamicStyles.plansContainer}>
        {plans.map((plan) => {
          const isCurrentPlan = auth.user?.premiumPlan === plan.id;
          const isElite = auth.user?.premiumPlan === 'elite';
          const canUpgrade = auth.user?.premiumPlan === 'plus' && plan.id === 'elite';
          const isDisabled = (isCurrentPlan || isElite) && !canUpgrade;

          return (
            <TouchableOpacity
              key={plan.id}
              style={[
                dynamicStyles.planCard,
                isCurrentPlan && { borderColor: accentColor, borderWidth: 2 }
              ]}
              onPress={() => !isDisabled && handlePurchase(plan.id)}
              disabled={isDisabled || processing !== null}
            >
              {isCurrentPlan && (
                <View style={[dynamicStyles.currentBadge, { backgroundColor: accentColor }]}>
                  <Text style={dynamicStyles.currentBadgeText}>CURRENT PLAN</Text>
                </View>
              )}
              
              <View style={dynamicStyles.planHeader}>
                <View>
                  <Text style={dynamicStyles.planName}>{plan.name}</Text>
                  <Text style={dynamicStyles.planPrice}>{plan.priceLabel}</Text>
                </View>
                <MaterialCommunityIcons 
                  name={plan.id === 'elite' ? 'crown' : 'star'} 
                  size={32} 
                  color={plan.id === 'elite' ? '#FFD700' : accentColor} 
                />
              </View>

              <View style={dynamicStyles.featuresList}>
                {plan.features.map((feature: string, idx: number) => (
                  <View key={idx} style={dynamicStyles.featureItem}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={accentColor} />
                    <Text style={dynamicStyles.featureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View 
                style={[
                  dynamicStyles.purchaseBtn, 
                  { backgroundColor: isDisabled ? theme.card + '80' : accentColor }
                ]}
              >
                {processing === plan.id ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={dynamicStyles.purchaseBtnText}>
                    {isCurrentPlan ? 'ACTIVE' : canUpgrade ? 'UPGRADE NOW' : isDisabled ? 'LOCKED' : 'CHOOSE PLAN'}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={dynamicStyles.footer}>
         <Text style={dynamicStyles.footerText}>Secure payment processing. Cancel anytime.</Text>
         <View style={dynamicStyles.paymentIcons}>
            <MaterialCommunityIcons name="credit-card-outline" size={20} color={theme.textSecondary} />
            <MaterialCommunityIcons name="google" size={25} color={theme.textSecondary} />
            <MaterialCommunityIcons name="apple" size={25} color={theme.textSecondary} />
         </View>
      </View>
    </ScrollView>
  );
}

const getStyles = (theme: any, accentColor: string, isDarkMode: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 10 },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: theme.text, fontSize: 24, fontWeight: '900', marginLeft: 10 },
  
  heroSection: { margin: 20, borderRadius: 30, overflow: 'hidden', elevation: 10, shadowColor: accentColor, shadowOpacity: 0.3, shadowRadius: 20 },
  heroGradient: { padding: 30, alignItems: 'center' },
  heroIcon: { marginBottom: 15 },
  heroTitle: { color: '#FFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  heroSub: { color: 'rgba(255,255,255,0.8)', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  plansContainer: { padding: 20, gap: 20 },
  planCard: { backgroundColor: theme.surface, borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border },
  eliteCard: { borderColor: '#8A2BE2', borderWidth: 2, shadowColor: '#8A2BE2', shadowOpacity: 0.2, shadowRadius: 15, elevation: 5 },
  popularBadge: { position: 'absolute', top: -12, right: 24, backgroundColor: '#8A2BE2', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  popularText: { color: '#FFF', fontSize: 10, fontWeight: '900' },
  
  planHeader: { marginBottom: 24 },
  planName: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline' },
  currency: { color: theme.textSecondary, fontSize: 18, fontWeight: '700' },
  price: { color: theme.text, fontSize: 36, fontWeight: '900', marginHorizontal: 2 },
  duration: { color: theme.textSecondary, fontSize: 14, fontWeight: '600' },

  featuresList: { gap: 12, marginBottom: 30 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { color: theme.text, fontSize: 14, fontWeight: '600' },

  buyBtn: { height: 56, backgroundColor: accentColor, borderRadius: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  buyBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: 1 },

  footer: { padding: 40, alignItems: 'center' },
  footerText: { color: theme.textSecondary, fontSize: 12, textAlign: 'center' },
  paymentIcons: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 16, opacity: 0.6 }
});
