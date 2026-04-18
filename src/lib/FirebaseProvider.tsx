import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, orderBy } from 'firebase/firestore';
import { Transaction, Holding, Account, Wallet, FamilyGoal, FamilyMember, Split, SpendingFine, UserProfile } from '../types';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  transactions: Transaction[];
  holdings: Holding[];
  accounts: Account[];
  wallet: Wallet | null;
  familyGoals: FamilyGoal[];
  familyMembers: FamilyMember[];
  splits: Split[];
  fines: SpendingFine[];
  userProfile: UserProfile | null;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [familyGoals, setFamilyGoals] = useState<FamilyGoal[]>([]);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
  const [splits, setSplits] = useState<Split[]>([]);
  const [fines, setFines] = useState<SpendingFine[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setIsAuthReady(true);
      
      if (user) {
        // Ensure user document exists
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);
        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            householdId: user.uid, // Default household is self
            createdAt: new Date().toISOString(),
          });
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Real-time listeners
  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setHoldings([]);
      setAccounts([]);
      setWallet(null);
      setFines([]);
      setSplits([]);
      setUserProfile(null);
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const unsubUser = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (!data.householdId) {
          setDoc(userDocRef, { ...data, householdId: user.uid }, { merge: true });
        }
        setUserProfile({ uid: docSnap.id, ...data } as UserProfile);
      }
    });

    const walletDocRef = doc(db, 'wallets', user.uid);
    const unsubWallet = onSnapshot(walletDocRef, (doc) => {
      if (doc.exists()) {
        setWallet(doc.data() as Wallet);
      } else {
        setWallet(null);
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, 'wallets'));

    const txQuery = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubTx = onSnapshot(txQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Transaction)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'transactions'));

    const holdingsQuery = query(
      collection(db, 'holdings'),
      where('uid', '==', user.uid)
    );
    const unsubHoldings = onSnapshot(holdingsQuery, (snapshot) => {
      setHoldings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Holding)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'holdings'));

    const accountsQuery = query(
      collection(db, 'accounts'),
      where('uid', '==', user.uid)
    );
    const unsubAccounts = onSnapshot(accountsQuery, (snapshot) => {
      setAccounts(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Account)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'accounts'));

    const splitsQuery = query(
      collection(db, 'splits'),
      where('uid', '==', user.uid),
      orderBy('date', 'desc')
    );
    const unsubSplits = onSnapshot(splitsQuery, (snapshot) => {
      setSplits(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Split)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'splits'));

    const finesQuery = query(
      collection(db, 'fines'),
      where('uid', '==', user.uid)
    );
    const unsubFines = onSnapshot(finesQuery, (snapshot) => {
      setFines(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as SpendingFine)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'fines'));

    return () => {
      unsubUser();
      unsubTx();
      unsubHoldings();
      unsubAccounts();
      unsubWallet();
      unsubSplits();
      unsubFines();
    };
  }, [user]);

  // Separate listener for household-shared collections
  useEffect(() => {
    if (!userProfile?.householdId) {
      setFamilyGoals([]);
      setFamilyMembers([]);
      return;
    }

    const householdId = userProfile.householdId;

    const familyGoalsQuery = query(
      collection(db, 'familyGoals'),
      where('uid', '==', householdId) // 'uid' field stores the householdId for these collections
    );
    const unsubFamilyGoals = onSnapshot(familyGoalsQuery, (snapshot) => {
      setFamilyGoals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyGoal)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'familyGoals'));

    const familyMembersQuery = query(
      collection(db, 'familyMembers'),
      where('uid', '==', householdId)
    );
    const unsubFamilyMembers = onSnapshot(familyMembersQuery, (snapshot) => {
      setFamilyMembers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FamilyMember)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'familyMembers'));

    return () => {
      unsubFamilyGoals();
      unsubFamilyMembers();
    };
  }, [userProfile?.householdId]);

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      loading, 
      isAuthReady, 
      transactions, 
      holdings, 
      accounts, 
      wallet,
      familyGoals,
      familyMembers,
      splits,
      fines,
      userProfile
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
