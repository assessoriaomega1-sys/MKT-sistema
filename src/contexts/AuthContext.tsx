import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, where, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole, ModulePermissions, Company } from '../types';
import { DEFAULT_ROLE_PERMISSIONS } from '../lib/permissions';
import { setActiveOwnerId } from '../lib/firebaseStorage';
import { storage } from '../lib/storage';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInAsCompany: (companyName: string, accessCode: string, ownerEmail?: string) => Promise<void>;
  signInAsCollaborator: (companyAccessCode: string, companyName?: string) => Promise<void>;
  updateCompanyAccessCode: (newCode: string) => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  hasPermission: (module: string, action: string) => boolean;
  isClientAllowed: (clientId: string) => boolean;
  isProcessAllowed: (processId: string) => boolean;
  updateCompanySettings: (settings: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (currUser) => {
      setUser(currUser);

      if (currUser) {
        const userRef = doc(db, 'users', currUser.uid);
        let d = await getDoc(userRef);

        let userProfile: UserProfile | null = null;

        if (d.exists()) {
          userProfile = d.data() as UserProfile;
          const isMasterAdmin = currUser.email === 'assessoriaomega1@gmail.com';
          const updates: any = { lastAccess: new Date().toISOString() };
          
          // If the user has no ownerId, they are the primary owner of this company workspace.
          if (!userProfile.ownerId) {
            if (userProfile.roleName !== 'Administrador' || isMasterAdmin) {
              updates.roleName = 'Administrador';
              updates.team = 'Diretoria';
              userProfile.roleName = 'Administrador';
              userProfile.team = 'Diretoria';
            }
            if (!userProfile.companyAccessCode) {
              const genCode = `EMP-${currUser.uid.slice(0, 4).toUpperCase()}`;
              updates.companyAccessCode = genCode;
              userProfile.companyAccessCode = genCode;
            }
            // Ensure company record exists for collaborator search
            try {
              await storage.saveCompany({
                id: currUser.uid,
                companyName: userProfile.agencyName || 'MKT',
                ownerUid: currUser.uid,
                ownerEmail: currUser.email || '',
                accessCode: userProfile.companyAccessCode || updates.companyAccessCode,
                createdAt: userProfile.createdAt || new Date().toISOString()
              });
            } catch (err) {
              console.warn('Error syncing company record in background:', err);
            }
          }
          if (!userProfile.agencyName) {
            updates.agencyName = 'MKT';
            userProfile.agencyName = 'MKT';
          }
          await setDoc(userRef, updates, { merge: true });
        } else {
          // Check if there's a pre-created profile matching this email (invited collaborator)
          const q = query(collection(db, 'users'), where('email', '==', currUser.email));
          const snap = await getDocs(q);

          if (!snap.empty) {
            const oldDoc = snap.docs[0];
            const oldData = oldDoc.data();
            userProfile = {
              ...oldData,
              id: currUser.uid,
              lastAccess: new Date().toISOString()
            } as UserProfile;

            // If this was an owner account without ownerId, grant Administrador
            if (!oldData.ownerId || currUser.email === 'assessoriaomega1@gmail.com') {
              userProfile.roleName = 'Administrador';
              userProfile.team = 'Diretoria';
              if (!userProfile.companyAccessCode) {
                userProfile.companyAccessCode = `EMP-${currUser.uid.slice(0, 4).toUpperCase()}`;
              }
            }

            await setDoc(userRef, userProfile);
            if (oldDoc.id !== currUser.uid) {
              await deleteDoc(oldDoc.ref);
            }

            // Ensure company is saved in companies collection for lookup
            if (!userProfile.ownerId && userProfile.companyAccessCode) {
              try {
                await storage.saveCompany({
                  id: currUser.uid,
                  companyName: userProfile.agencyName || 'MKT',
                  ownerUid: currUser.uid,
                  ownerEmail: currUser.email || '',
                  accessCode: userProfile.companyAccessCode,
                  createdAt: userProfile.createdAt || new Date().toISOString()
                });
              } catch (compErr) {
                console.warn('Could not sync company doc:', compErr);
              }
            }
          } else {
            // Brand new business owner or entrepreneur logging in!
            const names = currUser.displayName ? currUser.displayName.split(' ') : ['Empresário', ''];
            const defaultCode = `EMP-${currUser.uid.slice(0, 4).toUpperCase()}`;
            userProfile = {
              id: currUser.uid,
              managerName: currUser.displayName || 'Empresário',
              agencyName: 'MKT',
              companyRole: 'Empresário / Dono',
              companyAccessCode: defaultCode,
              companySetupCompleted: false,
              theme: 'light',
              firstName: names[0] || 'Empresário',
              lastName: names.slice(1).join(' ') || '',
              email: currUser.email || '',
              photoUrl: currUser.photoURL || '',
              status: 'ACTIVE',
              roleName: 'Administrador',
              team: 'Diretoria',
              createdAt: new Date().toISOString(),
              lastAccess: new Date().toISOString()
            } as UserProfile;

            await setDoc(userRef, userProfile);
            try {
              await storage.saveCompany({
                id: currUser.uid,
                companyName: 'MKT',
                ownerUid: currUser.uid,
                ownerEmail: currUser.email || '',
                accessCode: defaultCode,
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.warn('Error saving initial company:', err);
            }
          }
        }

        if (userProfile) {
          setActiveOwnerId(userProfile.ownerId || currUser.uid);
          setProfile(userProfile);
        }

        // Set real-time listener for user profile
        unsubscribeProfile = onSnapshot(userRef, (snapshot) => {
          if (snapshot.exists()) {
            const p = snapshot.data() as UserProfile;
            setActiveOwnerId(p.ownerId || currUser.uid);
            setProfile(p);
          }
        });

      } else {
        setActiveOwnerId(null);
        setProfile(null);
        if (unsubscribeProfile) {
          unsubscribeProfile();
          unsubscribeProfile = null;
        }
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, []);

  // Sync roles from DB for real-time permissions update
  useEffect(() => {
    if (!profile) {
      setRoles([]);
      return;
    }
    const unsub = onSnapshot(collection(db, 'roles'), (snap) => {
      setRoles(snap.docs.map(d => ({ ...d.data(), id: d.id } as UserRole)));
    });
    return unsub;
  }, [profile]);

  // Handle Light / Dark theme toggling dynamically
  useEffect(() => {
    if (profile?.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [profile?.theme]);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  // Empresa Registration / Login Flow
  const signInAsCompany = async (companyName: string, accessCode: string, ownerEmail?: string) => {
    const cleanCompanyName = companyName.trim() || 'MKT';
    const cleanCode = accessCode.trim().toUpperCase() || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const currUser = result.user;

    const names = currUser.displayName ? currUser.displayName.split(' ') : ['Empresário', ''];
    const userRef = doc(db, 'users', currUser.uid);

    // 1. Create / update company doc
    const companyRecord: Company = {
      id: currUser.uid,
      companyName: cleanCompanyName,
      ownerUid: currUser.uid,
      ownerEmail: currUser.email || ownerEmail || '',
      accessCode: cleanCode,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await storage.saveCompany(companyRecord);

    // 2. Create / update owner user profile
    const ownerProfile: UserProfile = {
      id: currUser.uid,
      managerName: currUser.displayName || 'Empresário',
      agencyName: cleanCompanyName,
      companyRole: 'Empresário / Dono',
      companyAccessCode: cleanCode,
      companySetupCompleted: true,
      theme: 'light',
      firstName: names[0] || 'Empresário',
      lastName: names.slice(1).join(' ') || '',
      email: currUser.email || ownerEmail || '',
      photoUrl: currUser.photoURL || '',
      status: 'ACTIVE',
      roleName: 'Administrador',
      team: 'Diretoria',
      createdAt: new Date().toISOString(),
      lastAccess: new Date().toISOString()
    };

    await setDoc(userRef, ownerProfile, { merge: true });
    setActiveOwnerId(currUser.uid);
    setProfile(ownerProfile);
  };

  // Colaborador Registration / Login Flow
  const signInAsCollaborator = async (companyAccessCode: string, companyName?: string) => {
    const cleanCode = companyAccessCode.trim().toUpperCase();
    if (!cleanCode) {
      throw new Error('Informe o código de acesso da empresa fornecido pelo dono.');
    }

    // Pre-check if found in companies collection
    let foundCompany = await storage.getCompanyByAccessCode(cleanCode);

    // Sign in with Google (this authenticates the user in Firebase Auth)
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const currUser = result.user;

    // If not found in public collection, search with the newly authenticated credentials
    if (!foundCompany) {
      foundCompany = await storage.getCompanyByAccessCode(cleanCode);
    }

    // If still not found, sign out immediately to prevent unauthorized or orphan session
    if (!foundCompany) {
      await signOut(auth);
      throw new Error(`Código de acesso "${cleanCode}" não foi encontrado. Confirme o código exato com o dono da empresa.`);
    }

    const names = currUser.displayName ? currUser.displayName.split(' ') : ['Colaborador', ''];
    const userRef = doc(db, 'users', currUser.uid);

    // Link collaborator directly to the company owner
    const colabProfile: UserProfile = {
      id: currUser.uid,
      managerName: currUser.displayName || 'Colaborador',
      agencyName: foundCompany.companyName || companyName || 'Empresa',
      ownerId: foundCompany.ownerUid, // Belongs to company workspace!
      companyRole: 'Colaborador',
      companyAccessCode: cleanCode,
      companySetupCompleted: true,
      theme: 'light',
      firstName: names[0] || 'Colaborador',
      lastName: names.slice(1).join(' ') || '',
      email: currUser.email || '',
      photoUrl: currUser.photoURL || '',
      status: 'ACTIVE',
      roleName: 'Colaborador',
      team: 'Operacional',
      createdAt: new Date().toISOString(),
      lastAccess: new Date().toISOString()
    };

    await setDoc(userRef, colabProfile, { merge: true });
    setActiveOwnerId(foundCompany.ownerUid);
    setProfile(colabProfile);
  };

  // Update company access code (Owner only)
  const updateCompanyAccessCode = async (newCode: string) => {
    const cleanCode = newCode.trim().toUpperCase();
    if (!cleanCode || !user) return;

    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, { companyAccessCode: cleanCode }, { merge: true });

    const companyRecord: Company = {
      id: user.uid,
      companyName: profile?.agencyName || 'MKT',
      ownerUid: user.uid,
      ownerEmail: user.email || '',
      accessCode: cleanCode,
      createdAt: profile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await storage.saveCompany(companyRecord);

    setProfile(prev => prev ? { ...prev, companyAccessCode: cleanCode } : null);
  };

  const logout = async () => {
    setActiveOwnerId(null);
    await signOut(auth);
  };

  const isAccountOwner = !!profile && !profile.ownerId;
  const isAdmin = profile?.roleName === 'Administrador' || 
                  profile?.roleName === 'Empresário' || 
                  profile?.roleName === 'Dono' || 
                  isAccountOwner || 
                  user?.email === 'assessoriaomega1@gmail.com';

  const hasPermission = (module: string, action: string): boolean => {
    if (!profile) {
      if (user?.email === 'assessoriaomega1@gmail.com') return true;
      return false;
    }
    if (profile.status === 'INACTIVE' && user?.email !== 'assessoriaomega1@gmail.com') return false;

    // Administrator or primary workspace owner has total access
    if (isAdmin) return true;

    // 1. Check custom overrides
    const custom = profile.customPermissions?.[module];
    if (custom !== undefined && custom[action as keyof ModulePermissions] !== undefined) {
      return !!custom[action as keyof ModulePermissions];
    }

    // 2. Check Role from DB
    const dbRole = roles.find(r => r.name === profile.roleName || r.id === profile.roleId);
    if (dbRole) {
      const rolePerm = dbRole.permissions?.[module];
      if (rolePerm !== undefined && rolePerm[action as keyof ModulePermissions] !== undefined) {
        return !!rolePerm[action as keyof ModulePermissions];
      }
    }

    // 3. Fallback to default static configuration
    const defaultPerm = DEFAULT_ROLE_PERMISSIONS[profile.roleName || '']?.[module];
    if (defaultPerm !== undefined && defaultPerm[action as keyof ModulePermissions] !== undefined) {
      return !!defaultPerm[action as keyof ModulePermissions];
    }

    return false;
  };

  const isClientAllowed = (clientId: string): boolean => {
    if (isAdmin) return true;
    if (!profile) return false;
    if (!profile.restrictedClients || profile.restrictedClients.length === 0) return true;
    return profile.restrictedClients.includes(clientId);
  };

  const isProcessAllowed = (processId: string): boolean => {
    if (isAdmin) return true;
    if (!profile) return false;
    if (!profile.restrictedProcesses || profile.restrictedProcesses.length === 0) return true;
    return profile.restrictedProcesses.includes(processId);
  };

  const updateCompanySettings = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await setDoc(userRef, updates, { merge: true });
    setProfile(prev => prev ? { ...prev, ...updates } : null);
  };

  const isAuthReady = !loading && (!user || profile !== null);

  return (
    <AuthContext.Provider value={{ 
      user, 
      profile, 
      loading: !isAuthReady, 
      signInWithGoogle, 
      signInAsCompany,
      signInAsCollaborator,
      updateCompanyAccessCode,
      logout,
      isAdmin,
      hasPermission,
      isClientAllowed,
      isProcessAllowed,
      updateCompanySettings
    }}>
      {isAuthReady && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

