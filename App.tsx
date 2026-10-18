import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { useFonts } from "expo-font";
import { api, post, Session, setBearer, setTokenRefresher } from "./src/api";
import { C, S } from "./src/theme";
import { Button, Field, Icon, Logo, Notice } from "./src/components";
import Merchant from "./src/Merchant";
import Admin from "./src/Admin";
import Driver from "./src/Driver";
import { useOidcLogin, restoreNativeAccess, signOutNative } from "./src/oidc";
import {
  launchRole,
  navigateRole,
  rolePath,
  openWholesaler,
} from "./src/runtime";
import Join, { invitationToken } from "./src/Join";
import { AcceptShopInvitation, teamInvitationToken } from "./src/ShopTeam";

async function readSaved(key: string) {
  return Platform.OS === "web"
    ? (key === "toushir-demo-workspace"
        ? window.localStorage
        : window.sessionStorage
      ).getItem(key)
    : SecureStore.getItemAsync(key);
}
async function save(key: string, value: string) {
  if (Platform.OS === "web")
    (key === "toushir-demo-workspace"
      ? window.localStorage
      : window.sessionStorage
    ).setItem(key, value);
  else await SecureStore.setItemAsync(key, value);
}
async function erase(key: string) {
  if (Platform.OS === "web")
    (key === "toushir-demo-workspace"
      ? window.localStorage
      : window.sessionStorage
    ).removeItem(key);
  else await SecureStore.deleteItemAsync(key);
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Application />
    </SafeAreaProvider>
  );
}
function Application() {
  const [fontsLoaded, fontError] = useFonts({
    Inter: require("./assets/DMSans.ttf"),
  });
  const secureLogin = useOidcLogin();
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [joinToken, setJoinToken] = useState<string | null>(null);
  const [teamToken, setTeamToken] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({
    name: "",
    shopName: "",
    email: "",
    phone: "",
    password: "",
    commune: "Oran",
    street: "",
  });
  const [demoAvailable, setDemoAvailable] = useState(false);
  const notify = (message: string) => {
    setNotice(message);
  };
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(() => setNotice(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [notice]);
  async function acceptSession(next: Session) {
    if (next.token && !next.token.includes(".")) {
      try {
        await signOutNative();
      } catch {}
    }
    setBearer(next.token || "");
    if (next.token) await save("toushir-token", next.token);
    if (next.workspaceToken)
      await save("toushir-demo-workspace", next.workspaceToken);
    if (next.workspace.canSwitchRole) await erase("toushir-personal-account");
    else {
      await save("toushir-personal-account", "true");
      await erase("toushir-demo-workspace");
    }
    if (next.workspace.isDemo && next.workspace.canSwitchRole)
      await post("/demo/showcase");
    setSession(next);
    setError("");
  }
  async function startDemo(
    role: "MERCHANT" | "ADMIN" | "DRIVER" = launchRole(),
    reuse = true,
  ) {
    setBusy(true);
    setError("");
    try {
      const workspaceToken = reuse
        ? (await readSaved("toushir-demo-workspace")) || session?.workspaceToken
        : null;
      const next = await post<Session>("/demo/session", {
        role,
        ...(workspaceToken ? { workspaceToken } : {}),
      });
      try {
        await signOutNative();
      } catch {}
      await acceptSession(next);
      setDemoAvailable(true);
      navigateRole(role);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function bootstrap() {
    setBooting(true);
    setError("");
    const savedBearer = await readSaved("toushir-token");
    const nativeRealSession =
      savedBearer?.split(".").length === 3 ||
      (await readSaved("toushir-personal-account")) === "true";
    try {
      if (Platform.OS === "web") {
        const savedAccess = window.location.hash.match(
          /^#workspace=([a-f0-9]{64})$/i,
        )?.[1];
        if (savedAccess) {
          await save("toushir-demo-workspace", savedAccess);
          await startDemo(launchRole());
          return;
        }
      }
      setTokenRefresher(() => restoreNativeAccess(true));
      setBearer(
        (await restoreNativeAccess()) ||
          (await readSaved("toushir-token")) ||
          "",
      );
      const current = await api<Session>("/auth/me");
      const desiredRole = launchRole();
      if (
        current.workspace.isDemo &&
        current.workspace.canSwitchRole &&
        current.user.role !== desiredRole
      )
        await startDemo(desiredRole);
      else {
        if (current.workspace.isDemo && current.workspace.canSwitchRole)
          await post("/demo/showcase");
        setSession({
          ...current,
          ...(current.workspace.canSwitchRole
            ? {
                workspaceToken:
                  (await readSaved("toushir-demo-workspace")) || undefined,
              }
            : {}),
        });
        setDemoAvailable(!!current.workspace.isDemo);
      }
    } catch (bootstrapError: any) {
      if (nativeRealSession) {
        setBearer("");
        setSession(null);
        setDemoAvailable(false);
        setError(
          bootstrapError.status === 0
            ? bootstrapError.message
            : "Votre session doit être renouvelée. Connectez-vous en toute sécurité.",
        );
        return;
      }
      try {
        const saved = await readSaved("toushir-demo-workspace");
        const role = launchRole();
        const next = await post<Session>("/demo/session", {
          role,
          ...(saved ? { workspaceToken: saved } : {}),
        });
        try {
          await signOutNative();
        } catch {}
        await acceptSession(next);
        setDemoAvailable(true);
      } catch (e: any) {
        if (e.status === 0) setError(e.message);
        else if (![403, 404].includes(e.status)) {
          await erase("toushir-demo-workspace");
          setDemoAvailable(true);
          setError(
            "Votre session a expiré. Ouvrez une nouvelle démonstration ou connectez-vous.",
          );
        }
      }
    } finally {
      setBooting(false);
    }
  }
  useEffect(() => {
    async function init() {
      const initial =
        Platform.OS === "web"
          ? window.location.href
          : await Linking.getInitialURL();
      const team = initial ? teamInvitationToken(initial) : null;
      const token = initial ? invitationToken(initial) : null;
      if (team) {
        setTeamToken(team);
        setBooting(false);
      } else if (token) {
        setJoinToken(token);
        setBooting(false);
      } else await bootstrap();
    }
    init();
    const subscription = Linking.addEventListener("url", ({ url }) => {
      const team = teamInvitationToken(url);
      const token = invitationToken(url);
      if (team) {
        setTeamToken(team);
        setJoinToken(null);
        setError("");
      } else if (token) {
        setJoinToken(token);
        setTeamToken(null);
        setError("");
      }
    });
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (
      session?.user.role !== "MERCHANT" ||
      (!session.user.shop?.isMember &&
        session.user.approvalStatus !== "PENDING")
    )
      return;
    let active = true;
    const timer = setInterval(() => {
      api<Session>("/auth/me")
        .then((next) => {
          if (active)
            setSession((previous) =>
              previous?.user.id === next.user.id ? next : previous,
            );
        })
        .catch(async (e) => {
          if (active && e.status === 401) {
            setBearer("");
            await erase("toushir-token");
            setSession(null);
            setError(
              "Votre accès au magasin a changé. Reconnectez-vous avec votre compte personnel.",
            );
          }
        });
    }, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [
    session?.user.id,
    session?.user.approvalStatus,
    session?.user.shop?.isMember,
  ]);
  async function logout() {
    try {
      await signOutNative();
    } catch {}
    try {
      await post("/auth/logout");
    } catch {}
    setBearer("");
    await erase("toushir-token");
    setSession(null);
    setNotice("");
  }
  async function secureAuthenticate() {
    setBusy(true);
    setError("");
    try {
      await acceptSession(await secureLogin.signIn());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function authenticate() {
    setBusy(true);
    setError("");
    try {
      const body =
        authMode === "login"
          ? { email: form.email, password: form.password }
          : {
              ...form,
              address: {
                label: "Mon commerce",
                wilaya: "Oran",
                commune: form.commune,
                street: form.street,
              },
            };
      await acceptSession(await post<Session>(`/auth/${authMode}`, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const update = (key: keyof typeof form) => (value: string) =>
    setForm((old) => ({ ...old, [key]: value }));
  if ((!fontsLoaded && !fontError) || booting)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: C.white,
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        <StatusBar barStyle="dark-content" />
        <Logo />
        <ActivityIndicator color={C.green} />
        <Text style={S.muted}>Ouverture de votre espace…</Text>
      </SafeAreaView>
    );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" />
      {teamToken !== null ? (
        <AcceptShopInvitation
          key={teamToken}
          token={teamToken}
          onCancel={() => {
            setTeamToken(null);
            if (Platform.OS === "web")
              window.history.replaceState(null, "", rolePath(launchRole()));
            if (!session) bootstrap();
          }}
          onJoined={async (next) => {
            await acceptSession(next);
            setTeamToken(null);
            if (Platform.OS === "web")
              window.history.replaceState(
                null,
                "",
                rolePath(launchRole()) + "#account",
              );
          }}
        />
      ) : joinToken !== null ? (
        <Join
          key={joinToken}
          initialToken={joinToken}
          onCancel={() => {
            setJoinToken(null);
            if (Platform.OS === "web")
              window.history.replaceState(null, "", rolePath(launchRole()));
            if (!session) bootstrap();
          }}
          onJoined={async (next) => {
            await acceptSession(next);
            setJoinToken(null);
            if (Platform.OS === "web")
              window.history.replaceState(null, "", rolePath(launchRole()));
          }}
        />
      ) : session ? (
        <UiBoundary key={session.user.id}>
          {session.user.role === "DRIVER" ? (
            <Driver
              session={session}
              onLogout={logout}
              onNotice={notify}
              onMerchant={() => startDemo("MERCHANT")}
            />
          ) : session.user.role === "ADMIN" ? (
            <Admin
              session={session}
              onSwitch={() => startDemo("MERCHANT")}
              onLogout={logout}
              onNotice={notify}
            />
          ) : (
            <Merchant
              session={session}
              onJoin={() => setJoinToken("")}
              onSwitch={async () => {
                await openWholesaler();
              }}
              onLogout={logout}
              onNotice={notify}
            />
          )}
        </UiBoundary>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1, backgroundColor: C.white }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 24,
              paddingVertical: 48,
            }}
          >
            <View
              style={{
                maxWidth: 400,
                width: "100%",
                alignSelf: "center",
                gap: 20,
              }}
            >
              <Logo />
              <Text style={[S.heading, { marginTop: 20 }]}>
                {authMode === "login"
                  ? launchRole() === "DRIVER"
                    ? "Votre tournée commence ici."
                    : "Bienvenue sur Toushir."
                  : "Inscrire mon commerce"}
              </Text>
              <Text style={S.muted}>
                {authMode === "login"
                  ? launchRole() === "DRIVER"
                    ? "Connectez-vous avec le compte livreur créé par votre grossiste."
                    : "Retrouvez vos produits et suivez vos commandes."
                  : "Le grossiste vérifiera votre commerce avant votre première demande."}
              </Text>
              {error ? <Notice error>{error}</Notice> : null}
              {authMode === "register" && (
                <>
                  <Field
                    label="Votre nom"
                    value={form.name}
                    onChangeText={update("name")}
                    autoComplete="name"
                  />
                  <Field
                    label="Nom du commerce"
                    value={form.shopName}
                    onChangeText={update("shopName")}
                  />
                  <Field
                    label="Téléphone professionnel"
                    value={form.phone}
                    onChangeText={update("phone")}
                    keyboardType="phone-pad"
                    autoComplete="tel"
                  />
                  <Field
                    label="Commune"
                    value={form.commune}
                    onChangeText={update("commune")}
                  />
                  <Field
                    label="Adresse"
                    value={form.street}
                    onChangeText={update("street")}
                  />
                </>
              )}
              {authMode === "login" ? (
                <Button
                  disabled={!secureLogin.ready}
                  loading={busy}
                  icon="lock-closed-outline"
                  onPress={secureAuthenticate}
                >
                  Se connecter en toute sécurité
                </Button>
              ) : (
                <>
                  {" "}
                  <Field
                    label="Adresse e-mail"
                    value={form.email}
                    onChangeText={update("email")}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                  <Field
                    label="Mot de passe"
                    value={form.password}
                    onChangeText={update("password")}
                    secureTextEntry
                    autoComplete="new-password"
                    onSubmitEditing={authenticate}
                  />
                  <Button
                    onPress={authenticate}
                    loading={busy}
                    icon="arrow-forward"
                  >
                    Créer mon compte
                  </Button>
                  {launchRole() !== "DRIVER" ? (
                    <Button
                      variant="ghost"
                      onPress={() => {
                        setAuthMode("login");
                        setError("");
                      }}
                    >
                      J’ai déjà un compte
                    </Button>
                  ) : null}
                </>
              )}
              {authMode === "login" && launchRole() !== "DRIVER" ? (
                <Button variant="ghost" onPress={() => setAuthMode("register")}>
                  Inscrire mon commerce
                </Button>
              ) : null}
              {launchRole() !== "DRIVER" ? (
                <Button
                  variant="secondary"
                  icon="storefront-outline"
                  onPress={() => setJoinToken("")}
                >
                  Rejoindre mon grossiste
                </Button>
              ) : null}
              {demoAvailable && (
                <Button
                  variant="secondary"
                  onPress={() => startDemo(launchRole(), false)}
                  loading={busy}
                >
                  Explorer la démonstration
                </Button>
              )}
              {error && !demoAvailable && (
                <Button
                  variant="secondary"
                  icon="refresh-outline"
                  onPress={bootstrap}
                >
                  Réessayer la connexion
                </Button>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
      {session && error ? (
        <View
          style={{
            position: "absolute",
            top: 14,
            left: 20,
            right: 20,
            zIndex: 110,
          }}
        >
          <Notice error>{error}</Notice>
          <Button small variant="secondary" onPress={() => setError("")}>
            Fermer
          </Button>
        </View>
      ) : null}
      {notice ? (
        <Pressable
          accessibilityRole="alert"
          onPress={() => setNotice("")}
          style={{
            position: "absolute",
            bottom: 88,
            left: 20,
            right: 20,
            maxWidth: 580,
            alignSelf: "center",
            backgroundColor: C.forest,
            borderRadius: 14,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            zIndex: 100,
          }}
        >
          <Icon name="checkmark-circle" color={C.white} />
          <Text style={[S.text, { color: C.white, flex: 1 }]}>{notice}</Text>
          <Icon name="close" color={C.white} size={18} />
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

class UiBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 30,
          gap: 22,
          backgroundColor: C.bg,
        }}
      >
        <Logo />
        <Text style={S.heading}>Reprenons votre réassort.</Text>
        <Text style={[S.muted, { textAlign: "center", maxWidth: 420 }]}>
          Cette vue n’a pas pu être affichée. Vos demandes déjà envoyées restent
          enregistrées.
        </Text>
        <Button
          icon="refresh-outline"
          onPress={() => this.setState({ failed: false })}
        >
          Rouvrir mon espace
        </Button>
      </View>
    ) : (
      this.props.children
    );
  }
}
