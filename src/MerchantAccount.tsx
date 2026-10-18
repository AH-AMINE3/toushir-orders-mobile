import React, { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Address, api, money, Session } from "./api";
import { Button, Notice, Status } from "./components";
import { Loyalty } from "./Engagement";
import { useEngagementLive } from "./realtime";
import { C, S } from "./theme";
import ShopTeam, { shopRoleNames } from "./ShopTeam";
import AssistedRequests from "./AssistedRequests";
import MerchantActivity from "./MerchantActivity";
import { StateArrival } from "./Motion";

export type AccountPanel =
  | "rewards"
  | "activity"
  | "payments"
  | "shop"
  | "team"
  | "assistance"
  | "settings"
  | null;
export const accountTitles = {
  rewards: "Mes points et cadeaux",
  activity: "Mon activité",
  payments: "Documents et règlements",
  shop: "Mon magasin",
  team: "Équipe du magasin",
  assistance: "Demandes assistées",
  settings: "Paramètres",
};
type Summary = {
  deliveredOrders: number;
  partiallyDeliveredOrders: number;
  orderCount: number;
  collectedThisMonth: number;
  refundedThisMonth: number;
  netPaidThisMonth: number;
  month: string;
};
type Wallet = { available: number; reserved: number; correctionDue: number };
type Props = {
  session: Session;
  panel: AccountPanel;
  onPanel: (panel: AccountPanel) => void;
  addresses: Address[];
  onAddAddress: () => void;
  onOrders: () => void;
  onOrder: (id: string) => void;
  onJoin: () => void;
  onSwitch: () => void;
  onLogout: () => void;
  onNotice: (text: string) => void;
};
const assets = {
  logo: require("../assets/figma/mobile-merchant-account-43633.svg"),
  arrow: require("../assets/figma/mobile-merchant-account-6b6dd.svg"),
  clock: require("../assets/figma/mobile-merchant-account-60474.svg"),
  chevron: require("../assets/figma/mobile-merchant-account-dc894.svg"),
  gift: require("../assets/figma/mobile-merchant-account-5b801.svg"),
  activity: require("../assets/figma/mobile-merchant-account-fbf01.svg"),
  wallet: require("../assets/figma/mobile-merchant-account-04c8f.svg"),
  shop: require("../assets/figma/mobile-merchant-account-903ac.svg"),
  settings: require("../assets/figma/mobile-merchant-account-44fa4.svg"),
};
function Graphic({ source, size = 24 }: { source: number; size?: number }) {
  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      contentFit="contain"
      accessible={false}
    />
  );
}
function Row({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: number;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [A.row, { opacity: pressed ? 0.65 : 1 }]}
    >
      <Graphic source={icon} />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={A.rowTitle}>{title}</Text>
        <Text style={A.small}>{subtitle}</Text>
      </View>
      <Graphic source={assets.chevron} size={20} />
    </Pressable>
  );
}
export default function MerchantAccount({
  session,
  panel,
  onPanel,
  addresses,
  onAddAddress,
  onOrders,
  onOrder,
  onJoin,
  onSwitch,
  onLogout,
  onNotice,
}: Props) {
  const [wallet, setWallet] = useState<Wallet | null>(null),
    [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState("");
  async function refresh() {
    try {
      const [w, s] = await Promise.all([
        api<Wallet>("/loyalty"),
        api<Summary>("/profile/summary"),
      ]);
      setWallet(w);
      setSummary(s);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEngagementLive(session.user.id, refresh);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => clearInterval(timer);
  }, [session.user.id]);
  const problem = error ? (
    <View style={{ gap: 8 }}>
      <Notice error>{error}</Notice>
      <Button small variant="ghost" onPress={refresh}>
        Réessayer le résumé
      </Button>
    </View>
  ) : null;
  if (panel === "team")
    return <ShopTeam session={session} onNotice={onNotice} />;
  if (panel === "assistance")
    return (
      <AssistedRequests
        session={session}
        addresses={addresses}
        onNotice={onNotice}
        onShop={() => onPanel("shop")}
        onOrders={onOrders}
      />
    );
  if (panel === "rewards")
    return <Loyalty session={session} onNotice={onNotice} />;
  if (panel === "shop")
    return (
      <View style={A.detail}>
        <Text style={A.title}>
          {session.user.shopName || session.user.name}
        </Text>
        <Text style={S.text}>{session.user.name}</Text>
        <Text selectable style={S.muted}>
          {session.user.email}
        </Text>
        <Text style={S.muted}>
          {session.user.phone || "Téléphone non renseigné"}
        </Text>
        <Text style={S.small}>
          {shopRoleNames[session.user.shop?.role || "OWNER"]} · compte personnel
        </Text>
        <Status value={session.user.approvalStatus || "APPROVED"} />
        {session.user.approvalStatus === "PENDING" ? (
          <Notice>
            Votre commerce sera vérifié avant votre première demande.
          </Notice>
        ) : null}
        <Text style={[A.title, { marginTop: 12 }]}>Mes adresses</Text>
        {addresses.map((a) => (
          <View key={a.id} style={A.address}>
            <Text style={A.rowTitle}>{a.label}</Text>
            <Text style={S.text}>{a.street}</Text>
            <Text style={S.muted}>
              {a.commune}, {a.wilaya}
            </Text>
          </View>
        ))}
        <Button
          variant="secondary"
          icon="people-outline"
          onPress={() => onPanel("team")}
        >
          Équipe du magasin
        </Button>
        {session.user.shop?.canManage !== false ? (
          <Button variant="secondary" icon="add" onPress={onAddAddress}>
            Ajouter une adresse
          </Button>
        ) : (
          <Text style={S.small}>
            Le propriétaire et les responsables gèrent les adresses du magasin.
          </Text>
        )}
      </View>
    );
  if (panel === "settings")
    return (
      <View style={A.detail}>
        <Row
          icon={assets.shop}
          title="Mon magasin"
          subtitle="Coordonnées et adresses de livraison"
          onPress={() => onPanel("shop")}
        />
        <Button variant="secondary" icon="storefront-outline" onPress={onJoin}>
          Rejoindre mon grossiste
        </Button>
        {session.workspace.canSwitchRole ? (
          <Button
            variant="secondary"
            icon="business-outline"
            onPress={onSwitch}
          >
            Accéder à l’espace grossiste
          </Button>
        ) : null}
        <Text style={[A.title, { marginTop: 12 }]}>À propos du catalogue</Text>
        <Text style={S.muted}>
          Les fiches et photos proviennent d’Open Food Facts. Votre grossiste
          confirme ses prix, ses conditionnements et son stock dans son offre.
        </Text>
        <Button
          variant="ghost"
          icon="open-outline"
          onPress={() =>
            Linking.openURL(
              "https://world.openfoodfacts.org/terms-of-use",
            ).catch((e) => onNotice(e.message))
          }
        >
          Sources et attribution
        </Button>
        <Button variant="ghost" icon="log-out-outline" onPress={onLogout}>
          Se déconnecter
        </Button>
      </View>
    );
  if (panel === "activity" || panel === "payments")
    return (
      <MerchantActivity
        key={panel}
        payments={panel === "payments"}
        onOrders={onOrders}
        onOrder={onOrder}
      />
    );
  return (
    <View style={A.content}>
      <Text style={A.shopName}>
        {session.user.shopName || session.user.name}
      </Text>
      {session.user.shop?.isMember ? (
        <Text style={S.small}>
          {session.user.name} · {shopRoleNames[session.user.shop.role]}
        </Text>
      ) : null}
      {problem}
      <StateArrival changeKey={wallet?.available ?? "loading"}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Ma carte Toushir, ${wallet?.available ?? "chargement des"} points disponibles. Voir mes points et cadeaux`}
          onPress={() => onPanel("rewards")}
          style={({ pressed }) => [A.card, { opacity: pressed ? 0.9 : 1 }]}
        >
          <View style={[S.row, { gap: 12 }]}>
            <Image
              source={assets.logo}
              style={{ width: 96, height: 25 }}
              contentFit="contain"
              accessibilityLabel="Toushir"
            />
            <Text style={A.cardLabel}>CARTE COMMERÇANT</Text>
          </View>
          <View style={[S.row, { gap: 10 }]}>
            <Text
              style={A.points}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {wallet ? wallet.available.toLocaleString("fr-DZ") : "—"}
            </Text>
            <View style={{ gap: 2, flex: 2 }}>
              <Text style={A.pointsLabel}>points</Text>
              <Text style={A.onDark}>disponibles</Text>
            </View>
          </View>
          <View style={S.between}>
            <Text numberOfLines={1} style={[A.cardLabel, { flex: 1 }]}>
              {session.user.shopName || session.user.name}
            </Text>
            <Graphic source={assets.arrow} />
          </View>
        </Pressable>
      </StateArrival>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Voir mes points réservés"
        onPress={() => onPanel("rewards")}
        style={A.reserved}
      >
        <Graphic source={assets.clock} size={20} />
        <Text style={[S.text, { flex: 1, fontSize: 13 }]}>
          {wallet ? wallet.reserved.toLocaleString("fr-DZ") : "—"} points
          réservés
        </Text>
        <Graphic source={assets.chevron} size={18} />
      </Pressable>
      {wallet && wallet.correctionDue > 0 ? (
        <Notice error>
          {wallet.correctionDue} points à régulariser. Consultez votre
          historique de points.
        </Notice>
      ) : null}
      <View style={[S.row, { gap: 12, alignItems: "stretch" }]}>
        {(
          [
            { id: "rewards", label: "Mes cadeaux", icon: assets.gift },
            { id: "activity", label: "Mon activité", icon: assets.activity },
          ] as const
        ).map((item) => (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            onPress={() => onPanel(item.id)}
            style={({ pressed }) => [
              A.tile,
              {
                backgroundColor: item.id === "rewards" ? C.rewardBg : C.bg,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Graphic source={item.icon} size={28} />
            <Text style={A.tileLabel}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ gap: 20, paddingTop: 2 }}>
        <Text style={A.title}>Vos achats</Text>
        <View style={[S.row, { alignItems: "flex-start" }]}>
          <View style={A.metric}>
            <Text style={A.stat}>{summary?.deliveredOrders ?? "—"}</Text>
            <Text style={A.small}>Commandes livrées</Text>
          </View>
          <View style={A.metric}>
            <Text style={A.stat}>
              {summary ? money(summary.netPaidThisMonth) : "—"}
            </Text>
            <Text style={A.small}>Réglé ce mois-ci</Text>
          </View>
        </View>
      </View>
      <View>
        <Row
          icon={assets.wallet}
          title="Documents et règlements"
          subtitle="Suivre vos paiements"
          onPress={() => onPanel("payments")}
        />
        <Row
          icon={assets.shop}
          title="Mon magasin"
          subtitle="Coordonnées et adresses"
          onPress={() => onPanel("shop")}
        />
        <Row
          icon={assets.shop}
          title="Équipe du magasin"
          subtitle="Comptes personnels et droits d’accès"
          onPress={() => onPanel("team")}
        />
        <Row
          icon={assets.settings}
          title="Demandes assistées"
          subtitle="Votre conseiller, avec votre accord"
          onPress={() => onPanel("assistance")}
        />
        <Row
          icon={assets.settings}
          title="Paramètres"
          subtitle="Compte et préférences"
          onPress={() => onPanel("settings")}
        />
      </View>
    </View>
  );
}
const A = StyleSheet.create({
  content: { paddingTop: 12, paddingBottom: 4, gap: 20 },
  shopName: {
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 19,
    color: C.muted,
  },
  card: { backgroundColor: C.ink, borderRadius: 20, padding: 24, gap: 18 },
  cardLabel: {
    fontFamily: "Inter",
    fontSize: 10,
    lineHeight: 14,
    color: "#BACABF",
  },
  points: {
    fontFamily: "Inter",
    fontSize: 40,
    fontWeight: "700",
    lineHeight: 46,
    letterSpacing: -0.6,
    color: C.white,
    flex: 3,
    flexShrink: 1,
  },
  pointsLabel: {
    fontFamily: "Inter",
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    color: C.white,
  },
  onDark: {
    fontFamily: "Inter",
    fontSize: 12,
    lineHeight: 17,
    color: "#BACABF",
  },
  reserved: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 44,
    marginVertical: -10,
  },
  tile: { flex: 1, borderRadius: 16, padding: 16, gap: 14, minHeight: 96 },
  tileLabel: {
    fontFamily: "Inter",
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
    color: C.ink,
  },
  title: {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    color: C.ink,
  },
  metric: { flex: 1, gap: 6, minWidth: 0 },
  stat: {
    fontFamily: "Inter",
    fontSize: 24,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.6,
    color: C.ink,
  },
  small: { fontFamily: "Inter", fontSize: 12, lineHeight: 17, color: C.muted },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 78,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderColor: C.border,
  },
  rowTitle: {
    fontFamily: "Inter",
    fontSize: 15,
    lineHeight: 21,
    fontWeight: "700",
    color: C.ink,
  },
  detail: { paddingTop: 16, gap: 16, paddingBottom: 12 },
  address: {
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
});
