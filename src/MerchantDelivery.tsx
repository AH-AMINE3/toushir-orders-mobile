import React, { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Svg, { Rect } from "react-native-svg";
import qrcode from "qrcode-generator";
import { api, date, money, Order, post } from "./api";
import { Tracking, ReceiptSelection } from "./courier-api";
import { Button, Icon, Notice } from "./components";
import { C, S } from "./theme";
import { MeasuredProgress, StateArrival } from "./Motion";

type Challenge = {
  challenge: string;
  expiresAt: string;
  orderId: string;
  version: number;
};
function Qr({ value }: { value: string }) {
  const qr = useMemo(() => {
    const q = qrcode(0, "M");
    q.addData(value);
    q.make();
    return q;
  }, [value]);
  const count = qr.getModuleCount();
  return (
    <Svg
      accessibilityLabel="QR de réception à usage unique"
      width={240}
      height={240}
      viewBox={`-4 -4 ${count + 8} ${count + 8}`}
    >
      <Rect x={-4} y={-4} width={count + 8} height={count + 8} fill="white" />
      {Array.from({ length: count }, (_, r) =>
        Array.from({ length: count }, (_, c) =>
          qr.isDark(r, c) ? (
            <Rect
              key={`${r}-${c}`}
              x={c}
              y={r}
              width={1}
              height={1}
              fill="#151917"
            />
          ) : null,
        ),
      )}
    </Svg>
  );
}
export default function MerchantDelivery({
  order,
  onRefresh,
  canWrite = true,
}: {
  order: Order;
  onRefresh: () => void;
  canWrite?: boolean;
}) {
  const [tracking, setTracking] = useState<Tracking | null>(null),
    [error, setError] = useState(""),
    [lastSync, setLastSync] = useState<string | null>(null),
    [connected, setConnected] = useState(true),
    [busy, setBusy] = useState(false),
    [phase, setPhase] = useState<"tracking" | "check" | "consent" | "qr">(
      "tracking",
    ),
    [items, setItems] = useState<ReceiptSelection[]>([]),
    [consent, setConsent] = useState(false),
    [challenge, setChallenge] = useState<Challenge | null>(null),
    [now, setNow] = useState(Date.now());
  async function refresh() {
    try {
      const next = await api<Tracking>(`/orders/${order.id}/tracking`);
      setTracking(next);
      setLastSync(new Date().toISOString());
      setConnected(true);
      setError("");
    } catch (e: any) {
      setConnected(false);
      setError(e.message);
    }
  }
  useEffect(() => {
    setTracking(null);
    setPhase("tracking");
    setItems([]);
    setChallenge(null);
    setConsent(false);
    setLastSync(null);
    refresh();
    const timer = setInterval(refresh, 8000),
      clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    };
  }, [order.id]);
  const current = tracking?.order || order,
    assignment = tracking?.assignment,
    location = tracking?.location,
    locationFresh =
      !!location &&
      now - new Date(location.capturedAt).getTime() < 90000 &&
      location.isFresh;
  const preparation = tracking?.preparation;
  const preparedTotal =
    typeof preparation?.prepared === "number" ? preparation.prepared : 0;
  const requestedTotal =
    typeof preparation?.total === "number"
      ? preparation.total
      : current.items.reduce((sum, item) => sum + item.quantity, 0);
  const finished = [
      "DELIVERED",
      "PARTIALLY_DELIVERED",
      "DELIVERY_REFUSED",
    ].includes(current.status),
    arrived = assignment?.status === "ARRIVED";
  const seconds = challenge
    ? Math.max(
        0,
        Math.ceil((new Date(challenge.expiresAt).getTime() - now) / 1000),
      )
    : 0;
  function start() {
    setItems(
      current.items.map((i) => ({
        productId: i.productId,
        acceptedQuantity: i.quantity,
        refusedQuantity: 0,
      })),
    );
    setConsent(false);
    setChallenge(null);
    setError("");
    setPhase("check");
  }
  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await post<Challenge>(
        `/orders/${order.id}/receipt-challenge`,
        { version: tracking?.version, items },
      );
      setChallenge(result);
      setPhase("qr");
    } catch (e: any) {
      setError(e.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={V.wrap}>
      <View style={S.between}>
        <Text style={V.heading}>Suivre ma livraison</Text>
        <Icon name="car-outline" color={C.green} size={24} />
      </View>
      <Text style={S.small}>
        {connected ? "Actualisation toutes les 8 s" : "Connexion interrompue"}
        {lastSync ? ` · ${date(lastSync, true)}` : ""}
      </Text>
      {error ? <Notice error>{error}</Notice> : null}
      {!canWrite ? (
        <Text style={S.small}>
          Accès en lecture seule · une personne habilitée confirme les quantités
          reçues.
        </Text>
      ) : null}
      <StateArrival changeKey={`${current.status}-${assignment?.status}`}>
        <View style={V.status}>
          <Icon
            name={
              finished
                ? "checkmark-circle-outline"
                : arrived
                  ? "storefront-outline"
                  : current.status === "PREPARING"
                    ? "cube-outline"
                    : "car-outline"
            }
            color={C.green}
          />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.label}>
              {finished
                ? "Réception enregistrée"
                : arrived
                  ? "Votre livreur est arrivé"
                  : current.status === "OUT_FOR_DELIVERY"
                    ? "Votre commande arrive"
                    : current.status === "READY"
                      ? "Votre commande est prête"
                      : "Votre grossiste prépare la commande"}
            </Text>
            <Text style={S.muted}>
              {assignment?.driverName ||
                "Le livreur sera indiqué après affectation"}
            </Text>
          </View>
        </View>
      </StateArrival>
      {assignment ? (
        <View style={V.courier}>
          <View style={V.avatar}>
            <Text style={[S.label, { color: C.green }]}>
              {assignment.driverName
                .split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")}
            </Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={S.label}>{assignment.driverName}</Text>
            <Text style={S.small}>
              {assignment.status === "ARRIVED"
                ? "Arrivé au magasin"
                : assignment.pickedUpAt
                  ? "Votre livreur a pris en charge la commande"
                  : "Livreur affecté · en attente du départ"}
            </Text>
            {assignment.pickedUpAt ? (
              <Text style={S.small}>
                Départ enregistré : {date(assignment.pickedUpAt, true)}
              </Text>
            ) : null}
          </View>
          <Icon name="car-outline" color={C.green} size={25} />
        </View>
      ) : null}
      {location ? (
        <>
          <View style={S.between}>
            <Text style={S.label}>
              {locationFresh ? "Position récente" : "Dernière position connue"}
            </Text>
            <Text style={[S.small, { color: locationFresh ? C.green : C.red }]}>
              {date(location.capturedAt, true)}
            </Text>
          </View>
          <Text style={S.small}>
            Précision {Math.round(location.accuracy || 0)} m
            {locationFresh ? "" : " · signal ancien, à actualiser"}
          </Text>
          {Platform.OS === "web" ? (
            <View style={V.map}>
              {React.createElement("iframe", {
                title: `Dernière position GPS de ${assignment?.driverName || "votre livreur"}`,
                src: `https://www.openstreetmap.org/export/embed.html?bbox=${location.longitude - 0.006}%2C${location.latitude - 0.004}%2C${location.longitude + 0.006}%2C${location.latitude + 0.004}&layer=mapnik&marker=${location.latitude}%2C${location.longitude}`,
                loading: "lazy",
                referrerPolicy: "no-referrer",
                style: { width: "100%", height: "100%", border: 0 },
                tabIndex: 0,
              })}
            </View>
          ) : null}
          <Text style={S.small}>
            Point GPS partagé par le livreur. L’itinéraire et l’heure d’arrivée
            ne sont pas calculés.
          </Text>
          <Button
            variant="secondary"
            icon="map-outline"
            onPress={() =>
              Linking.openURL(
                `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`,
              ).catch(() => setError("La carte n’a pas pu être ouverte."))
            }
          >
            Voir la position sur la carte
          </Button>
        </>
      ) : assignment ? (
        <Text style={S.muted}>
          Le livreur ne partage pas encore sa position. Les étapes de livraison
          restent disponibles.
        </Text>
      ) : null}
      {tracking?.preparation ? (
        <View style={V.preparation}>
          <View style={S.between}>
            <Text style={S.label}>Préparation des produits</Text>
            <Text style={[S.label, { color: C.green }]}>
              {preparedTotal} / {requestedTotal}
            </Text>
          </View>
          <MeasuredProgress
            value={requestedTotal ? preparedTotal / requestedTotal : 0}
            label={`${preparedTotal} unités préparées sur ${requestedTotal}`}
          />
          {current.items.map((i) => (
            <View key={i.productId} style={[S.between, { gap: 12 }]}>
              <Icon
                name={
                  (preparation.items?.find(
                    (p: any) => p.productId === i.productId,
                  )?.preparedQuantity ??
                    (i as any).preparedQuantity ??
                    0) >= i.quantity
                    ? "checkmark-circle"
                    : "ellipse-outline"
                }
                color={C.green}
                size={18}
              />
              <Text style={[S.small, { flex: 1 }]} numberOfLines={2}>
                {i.name}
              </Text>
              <Text style={S.label}>
                {(i as any).preparedQuantity ??
                  (Array.isArray(tracking.preparation?.items)
                    ? tracking.preparation.items.find(
                        (p: any) => p.productId === i.productId,
                      )?.preparedQuantity
                    : null) ??
                  "—"}{" "}
                / {i.quantity}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {finished ? (
        <Notice>
          La réception est enregistrée. Consultez le paiement ci-dessous pour
          vérifier les espèces réellement encaissées.
        </Notice>
      ) : arrived && canWrite && phase === "tracking" ? (
        <Button icon="checkmark-circle-outline" onPress={start}>
          Vérifier les produits reçus
        </Button>
      ) : null}
      {!finished && canWrite && phase === "check" ? (
        <>
          <Text style={V.title}>Vérifiez vos produits.</Text>
          <Text style={S.muted}>
            Comptez les quantités reçues avec le livreur. Les quantités refusées
            restent visibles dans la preuve.
          </Text>
          {items.map((line, index) => {
            const product = current.items.find(
              (i) => i.productId === line.productId,
            )!;
            return (
              <View key={line.productId} style={V.quantity}>
                <Text style={S.label}>{product.name}</Text>
                <View style={S.between}>
                  <Text style={S.small}>
                    {product.quantity} livrées · {line.refusedQuantity} refusées
                  </Text>
                  <View style={S.row}>
                    <Button
                      label={`Refuser une unité de ${product.name}`}
                      variant="secondary"
                      icon="remove"
                      onPress={() =>
                        setItems((old) =>
                          old.map((l, i) =>
                            i === index
                              ? {
                                  ...l,
                                  acceptedQuantity: Math.max(
                                    0,
                                    l.acceptedQuantity - 1,
                                  ),
                                  refusedQuantity: Math.min(
                                    product.quantity,
                                    l.refusedQuantity + 1,
                                  ),
                                }
                              : l,
                          ),
                        )
                      }
                    />
                    <Text style={S.label}>{line.acceptedQuantity}</Text>
                    <Button
                      label={`Accepter une unité de ${product.name}`}
                      variant="secondary"
                      icon="add"
                      onPress={() =>
                        setItems((old) =>
                          old.map((l, i) =>
                            i === index
                              ? {
                                  ...l,
                                  acceptedQuantity: Math.min(
                                    product.quantity,
                                    l.acceptedQuantity + 1,
                                  ),
                                  refusedQuantity: Math.max(
                                    0,
                                    l.refusedQuantity - 1,
                                  ),
                                }
                              : l,
                          ),
                        )
                      }
                    />
                  </View>
                </View>
              </View>
            );
          })}
          <Button onPress={() => setPhase("consent")}>
            Continuer avec ces quantités
          </Button>
          <Button variant="ghost" onPress={() => setPhase("tracking")}>
            Revenir au suivi
          </Button>
        </>
      ) : null}
      {!finished && canWrite && phase === "consent" ? (
        <>
          <Text style={V.title}>Confirmez la réception.</Text>
          <Text style={S.muted}>
            {items.reduce((s, i) => s + i.acceptedQuantity, 0)} unités acceptées
            · {items.reduce((s, i) => s + i.refusedQuantity, 0)} refusées
          </Text>
          <Notice>
            Votre accord porte sur les quantités contrôlées. Le QR de réception
            n’enregistre aucun paiement.
          </Notice>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((v) => !v)}
            style={V.consent}
          >
            <Icon
              name={consent ? "checkbox" : "square-outline"}
              color={C.green}
              size={25}
            />
            <Text style={[S.text, { flex: 1 }]}>
              J’ai vérifié les quantités avec le livreur et j’approuve cette
              réception.
            </Text>
          </Pressable>
          <Button loading={busy} disabled={!consent} onPress={create}>
            Créer mon QR de réception
          </Button>
          <Button variant="ghost" onPress={() => setPhase("check")}>
            Modifier les quantités
          </Button>
        </>
      ) : null}
      {!finished && canWrite && phase === "qr" && challenge ? (
        <>
          <View style={V.approved}>
            <Text style={[S.small, { color: C.green }]}>
              Réception approuvée · v{challenge.version}
            </Text>
          </View>
          <Text style={V.title}>
            Présentez ce QR
            {assignment?.driverName
              ? ` à ${assignment.driverName}`
              : " au livreur"}
            .
          </Text>
          <Text style={S.muted}>
            {items.reduce((s, i) => s + i.acceptedQuantity, 0)} unités acceptées
            · {money(current.total)} avant ajustement éventuel
          </Text>
          {seconds > 0 ? (
            <View style={V.qr}>
              <Qr
                value={JSON.stringify({
                  challenge: challenge.challenge,
                  orderId: challenge.orderId,
                })}
              />
              <Text style={S.small}>
                Expire dans {Math.floor(seconds / 60)} min {seconds % 60} s
              </Text>
            </View>
          ) : (
            <Notice error>
              Votre code a expiré. Vérifiez les quantités puis générez un
              nouveau QR.
            </Notice>
          )}
          <Notice>
            Usage unique. Le livreur doit voir les mêmes quantités avant de
            continuer. Aucun paiement n’est effectué par ce scan.
          </Notice>
          <Text selectable style={S.small}>
            Code de secours : {challenge.challenge}
          </Text>
          <Button
            onPress={async () => {
              await refresh();
              onRefresh();
            }}
          >
            Consulter l’état de la remise
          </Button>
          <Button variant="secondary" loading={busy} onPress={create}>
            Renouveler mon code
          </Button>
          <Button
            variant="ghost"
            onPress={() => {
              setChallenge(null);
              setPhase("check");
            }}
          >
            Revoir mes quantités
          </Button>
        </>
      ) : null}
      <Button variant="ghost" icon="refresh-outline" onPress={refresh}>
        Actualiser le suivi
      </Button>
    </View>
  );
}
const V = StyleSheet.create({
  courier: { ...S.row, paddingVertical: 8, gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    backgroundColor: C.mint,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  map: {
    height: 210,
    overflow: "hidden",
    backgroundColor: C.bg,
    borderRadius: 12,
  },
  wrap: { backgroundColor: "white", borderRadius: 16, padding: 20, gap: 16 },
  heading: {
    fontFamily: "Inter",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    color: "#151917",
  },
  title: {
    fontFamily: "Inter",
    fontSize: 26,
    lineHeight: 36,
    fontWeight: "700",
    color: "#151917",
  },
  status: {
    backgroundColor: "#D9EDDF",
    padding: 14,
    borderRadius: 12,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  preparation: { gap: 12, paddingVertical: 8 },
  quantity: {
    gap: 14,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#E7EBE7",
  },
  consent: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  approved: {
    backgroundColor: "#D9EDDF",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
  },
  qr: {
    alignItems: "center",
    padding: 20,
    borderWidth: 1,
    borderColor: "#E7EBE7",
    borderRadius: 16,
    gap: 14,
  },
});
