import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, date, money, statuses } from "./api";
import { Image } from "expo-image";
import { Button, Empty, FilterPill, Icon, Notice, Status } from "./components";
import { MeasuredProgress, StateArrival } from "./Motion";
import { C, S } from "./theme";

export type MerchantActivityData = {
  period: { days: number; from: string; to: string };
  orders: {
    total: number;
    active: number;
    delivered: number;
    cancelled: number;
  };
  financial: {
    orderedTotal: number;
    paid: number;
    refunded: number;
    netPaid: number;
    outstanding: number;
  };
  daily: {
    date: string;
    orderedTotal: number;
    paid: number;
    orderCount: number;
  }[];
  topCategories: { name: string; total: number; quantity: number }[];
  recentOrders: {
    id: string;
    number: string;
    status: string;
    total: number | null;
    paidAmount: number;
    createdAt: string;
  }[];
  refreshedAt: string;
  basis?: {
    orderedTotal: string;
    paid: string;
    outstanding: string;
    categories: string;
  };
};

export default function MerchantActivity({
  payments = false,
  onOrders,
  onOrder,
}: {
  payments?: boolean;
  onOrders: () => void;
  onOrder: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [days, setDays] = useState(30),
    [data, setData] = useState<MerchantActivityData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [measure, setMeasure] = useState<"orderedTotal" | "paid">(
      payments ? "paid" : "orderedTotal",
    );
  useEffect(() => {
    let active = true;
    setLoading(true);
    setData(null);
    setSelected(null);
    setError("");
    const refresh = () =>
      api<MerchantActivityData>(`/profile/activity?days=${days}`)
        .then((next) => {
          if (active) {
            setData(next);
            setError("");
          }
        })
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    refresh();
    const timer = setInterval(refresh, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [days, revision]);
  const buckets = data
    ? aggregate(data.daily, days > 30 ? 12 : days > 7 ? 10 : 7)
    : [];
  const maximum = Math.max(1, ...buckets.map((b) => Math.abs(b[measure])));
  const negative = buckets.some((b) => b[measure] < 0);
  const focus = selected == null ? null : buckets[selected];
  return (
    <View style={A.wrap}>
      <View style={S.between}>
        <View style={[S.row, { gap: 8 }]}>
          {[7, 30, 90].map((d) => (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityState={{ selected: days === d }}
              onPress={() => setDays(d)}
              style={[A.period, { backgroundColor: days === d ? C.ink : C.bg }]}
            >
              <Text
                style={[A.periodText, { color: days === d ? C.white : C.ink }]}
              >
                {d} jours
              </Text>
            </Pressable>
          ))}
        </View>
        <Button
          variant="ghost"
          icon="refresh-outline"
          label="Actualiser mon activité"
          onPress={() => setRevision((v) => v + 1)}
          style={{ width: 44, minHeight: 44, paddingHorizontal: 0 }}
        />
      </View>
      {error ? (
        <>
          <Notice error>{error}</Notice>
          <Button variant="secondary" onPress={() => setRevision((v) => v + 1)}>
            Réessayer l’activité
          </Button>
        </>
      ) : null}
      {loading ? (
        <View style={{ padding: 30, alignItems: "center", gap: 12 }}>
          <ActivityIndicator color={C.green} />
          <Text style={S.small}>
            Vos commandes et règlements se mettent à jour…
          </Text>
        </View>
      ) : null}
      {data ? (
        <StateArrival changeKey={`${days}-${revision}`} style={{ gap: 20 }}>
          <View style={A.ledger}>
            <Text style={A.darkLabel}>RÉGLÉS SUR LA PÉRIODE</Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
              style={A.amount}
            >
              {money(data.financial.netPaid)}
            </Text>
            <Text style={A.darkDetail}>Encaissements, retours déduits.</Text>
          </View>
          <View style={A.facts}>
            <View style={A.fact}>
              <Text style={A.figure}>{data.orders.delivered}</Text>
              <Text style={S.small}>Commandes livrées</Text>
            </View>
            <View style={[A.fact, { backgroundColor: C.mint }]}>
              <Text style={A.figure}>{data.orders.active}</Text>
              <Text style={S.small}>Commandes en cours</Text>
            </View>
          </View>
          {data.financial.outstanding > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={onOrders}
              style={A.due}
            >
              <Image
                source={require("../assets/figma/astra-activity-wallet.svg")}
                style={{ width: 22, height: 22 }}
              />
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={S.label}>
                  {money(data.financial.outstanding)} à régler
                </Text>
                <Text style={[S.small, { color: C.reward }]}>
                  Consulter les commandes concernées
                </Text>
              </View>
              <Icon name="arrow-forward" size={20} />
            </Pressable>
          ) : null}
          <View style={{ gap: 4 }}>
            <View style={S.between}>
              <Text
                style={[
                  S.subheading,
                  { fontSize: 22, lineHeight: 30, fontWeight: "700" },
                ]}
              >
                Dernières commandes
              </Text>
              <Button small variant="ghost" onPress={onOrders}>
                Tout voir
              </Button>
            </View>
            {data.recentOrders.map((order) => (
              <Pressable
                key={order.id}
                accessibilityRole="button"
                onPress={() => onOrder(order.id)}
                style={A.order}
              >
                {order.status === "DELIVERED" ? (
                  <Image
                    source={require("../assets/figma/astra-order-check.svg")}
                    style={{ width: 24, height: 24 }}
                  />
                ) : (
                  <Icon name="cube-outline" color={C.ink} size={24} />
                )}
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={S.label}>
                    {order.number} · {money(order.total)}
                  </Text>
                  <Text style={S.small}>
                    {date(order.createdAt)} · {money(order.paidAmount)}{" "}
                    encaissés
                  </Text>
                  <Text style={S.small}>
                    {statuses[order.status] || order.status}
                  </Text>
                </View>
                <Image
                  source={require("../assets/figma/astra-order-chevron.svg")}
                  style={{ width: 20, height: 20 }}
                />
              </Pressable>
            ))}
            {!data.recentOrders.length ? (
              <Empty
                title="Votre activité commence ici"
                message="Vos commandes et vos paiements alimenteront ce suivi."
                icon="bar-chart-outline"
                action={<Button onPress={onOrders}>Voir mes commandes</Button>}
              />
            ) : null}
          </View>
          <Button
            variant="ghost"
            onPress={() => setExpanded((value) => !value)}
            icon={expanded ? "chevron-up" : "chevron-down"}
          >
            {expanded
              ? "Masquer le détail de l’activité"
              : "Explorer mon activité"}
          </Button>
          {expanded ? (
            <View style={{ gap: 24 }}>
              <View style={{ gap: 14 }}>
                <Text style={S.subheading}>Votre rythme de réassort</Text>
                <View style={[S.row, { gap: 8 }]}>
                  <FilterPill
                    selected={measure === "orderedTotal"}
                    onPress={() => setMeasure("orderedTotal")}
                  >
                    Commandé
                  </FilterPill>
                  <FilterPill
                    selected={measure === "paid"}
                    onPress={() => setMeasure("paid")}
                  >
                    Encaissé net
                  </FilterPill>
                </View>
                <View style={{ minHeight: 45, gap: 3 }}>
                  <Text style={S.label}>
                    {focus
                      ? money(focus[measure])
                      : money(
                          measure === "paid"
                            ? data.financial.netPaid
                            : data.financial.orderedTotal,
                        )}
                  </Text>
                  <Text style={S.small}>
                    {focus
                      ? `${date(focus.from)}${focus.from !== focus.to ? ` – ${date(focus.to)}` : ""} · ${focus.orderCount} commande${focus.orderCount === 1 ? "" : "s"}`
                      : "Touchez une barre pour consulter la période."}
                  </Text>
                </View>
                <View
                  style={A.chart}
                  accessibilityLabel={`Évolution des ${measure === "paid" ? "encaissements" : "commandes"} sur ${days} jours`}
                >
                  {buckets.map((bucket, index) => (
                    <Pressable
                      key={bucket.from}
                      accessibilityRole="button"
                      accessibilityState={{ selected: selected === index }}
                      accessibilityLabel={`${date(bucket.from)}, ${money(bucket[measure])}, ${bucket.orderCount} commandes`}
                      onPress={() =>
                        setSelected(selected === index ? null : index)
                      }
                      style={A.barTarget}
                    >
                      <View
                        style={{
                          width: "100%",
                          height: negative ? 154 : 110,
                          position: "relative",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            position: "absolute",
                            top: negative ? 77 : 109,
                            width: "100%",
                            height: 1,
                            backgroundColor: C.border,
                          }}
                        />
                        <View
                          style={[
                            A.bar,
                            {
                              position: "absolute",
                              bottom:
                                bucket[measure] >= 0
                                  ? negative
                                    ? 77
                                    : 0
                                  : undefined,
                              top: bucket[measure] < 0 ? 78 : undefined,
                              height: Math.max(
                                3,
                                (Math.abs(bucket[measure]) / maximum) *
                                  (negative ? 70 : 100),
                              ),
                              backgroundColor:
                                bucket[measure] < 0
                                  ? C.red
                                  : selected === index
                                    ? C.ink
                                    : C.green,
                              opacity:
                                selected != null && selected !== index
                                  ? 0.35
                                  : 1,
                            },
                          ]}
                        />
                      </View>
                      <Text style={A.axis}>
                        {index % (buckets.length > 7 ? 2 : 1) === 0
                          ? dayLabel(bucket.from)
                          : " "}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {negative ? (
                  <Text style={S.small}>
                    Les barres rouges sous zéro indiquent les remboursements
                    nets sur la période.
                  </Text>
                ) : null}
                {!buckets.some((b) => b[measure] !== 0) ? (
                  <Text style={S.small}>
                    Aucun {measure === "paid" ? "encaissement" : "achat tarifé"}{" "}
                    sur cette période.
                  </Text>
                ) : null}
              </View>
              {data.topCategories.length ? (
                <View style={{ gap: 15 }}>
                  <Text style={S.subheading}>
                    Vos rayons les plus commandés
                  </Text>
                  {data.topCategories.slice(0, 4).map((category) => (
                    <View key={category.name} style={{ gap: 7 }}>
                      <View style={S.between}>
                        <Text style={[S.label, { flex: 1 }]}>
                          {category.name}
                        </Text>
                        <Text style={S.small}>{money(category.total)}</Text>
                      </View>
                      <MeasuredProgress
                        value={
                          category.total /
                          Math.max(1, ...data.topCategories.map((c) => c.total))
                        }
                        label={`${category.name}, ${category.quantity} unités, ${money(category.total)}`}
                      />
                      <Text style={S.small}>
                        {category.quantity} unités commandées
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
          {payments ? (
            <Notice>
              {money(data.financial.paid)} encaissés ·{" "}
              {money(data.financial.refunded)} remboursés. Les bons de commande
              sont disponibles dans chaque commande et ne sont pas des factures
              fiscales.
            </Notice>
          ) : null}
          <Text style={S.small}>
            {data.basis?.orderedTotal ||
              "Montants actuels des commandes confirmées créées sur la période."}{" "}
            {data.basis?.paid ||
              "Encaissements moins remboursements selon la date du règlement."}{" "}
            {data.basis?.outstanding ||
              "Solde actuel des commandes confirmées non annulées."}
          </Text>
          {data.topCategories.length && data.basis?.categories ? (
            <Text style={S.small}>{data.basis.categories}</Text>
          ) : null}
          <Text style={S.small}>
            Du {date(data.period.from)} au {date(data.period.to)} ·{" "}
            {data.orders.total} commandes. Mis à jour le{" "}
            {date(data.refreshedAt, true)} · actualisation toutes les 15 s.
          </Text>
        </StateArrival>
      ) : null}
    </View>
  );
}
function dayLabel(value: string) {
  return new Date(value).toLocaleDateString("fr-DZ", {
    day: "numeric",
    timeZone: "Africa/Algiers",
  });
}
function aggregate(daily: MerchantActivityData["daily"], count: number) {
  const size = Math.max(1, Math.ceil(daily.length / count));
  const result: {
    from: string;
    to: string;
    orderedTotal: number;
    paid: number;
    orderCount: number;
  }[] = [];
  for (let i = 0; i < daily.length; i += size) {
    const set = daily.slice(i, i + size);
    result.push({
      from: set[0].date,
      to: set[set.length - 1].date,
      orderedTotal: set.reduce((s, d) => s + d.orderedTotal, 0),
      paid: set.reduce((s, d) => s + d.paid, 0),
      orderCount: set.reduce((s, d) => s + d.orderCount, 0),
    });
  }
  return result;
}
const A = StyleSheet.create({
  wrap: { paddingTop: 12, paddingBottom: 12, gap: 20 },
  ledger: {
    borderRadius: 16,
    backgroundColor: C.ink,
    padding: 24,
    gap: 12,
    minHeight: 154,
    justifyContent: "center",
  },
  period: {
    minHeight: 44,
    borderRadius: 24,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  periodText: { ...S.text, fontSize: 12, lineHeight: 17 },
  darkLabel: { ...S.label, color: "#BACABF", fontSize: 11, lineHeight: 15 },
  darkDetail: { ...S.small, color: "#BACABF", fontSize: 13, lineHeight: 18 },
  amount: { ...S.heading, color: C.white, fontSize: 36, lineHeight: 43 },
  ledgerFooter: {
    ...S.between,
    borderTopWidth: 1,
    borderColor: "#3F5146",
    marginTop: 5,
    paddingTop: 15,
  },
  facts: { flexDirection: "row", gap: 12 },
  fact: {
    flex: 1,
    gap: 8,
    minWidth: 0,
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 16,
    minHeight: 94,
  },
  figure: { ...S.subheading, fontSize: 30, lineHeight: 37, fontWeight: "700" },
  due: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    backgroundColor: C.rewardBg,
    borderRadius: 16,
    padding: 16,
    minHeight: 72,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 5,
    minHeight: 140,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  barTarget: {
    flex: 1,
    minHeight: 138,
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  bar: { width: "78%", borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  axis: { ...S.small, fontSize: 10, lineHeight: 16, marginBottom: 5 },
  order: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
});
