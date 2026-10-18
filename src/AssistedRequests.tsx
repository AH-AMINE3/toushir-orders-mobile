import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Address, api, CartQuote, date, post, Session } from "./api";
import { Button, Field, Icon, Notice } from "./components";
import { C, S } from "./theme";

const states: Record<string, string> = {
  AVAILABLE: "À transmettre",
  USED: "Demande transmise",
  REVOKED: "Révoquée",
  EXPIRED: "Expirée",
  AUTHORITY_ENDED: "Accès modifié",
  ADDRESS_CHANGED: "Adresse modifiée",
};
type Advisor = { id: string; name: string; version: number };
type Grant = {
  id: string;
  version: number;
  status: string;
  issuerName: string;
  advisorName: string;
  expiresAt: string;
  orderId?: string;
  items: { productId: string; name: string; quantity: number }[];
  address: { label: string; street: string; commune: string; wilaya: string };
  note: string;
};
type Info = {
  canAuthorize: boolean;
  advisor: Advisor | null;
  validUntil?: string | null;
  items: Grant[];
};

export default function AssistedRequests({
  session,
  addresses,
  onNotice,
  onShop,
  onOrders,
}: {
  session: Session;
  addresses: Address[];
  onNotice: (message: string) => void;
  onShop: () => void;
  onOrders: () => void;
}) {
  const [info, setInfo] = useState<Info | null>(null),
    [cart, setCart] = useState<CartQuote | null>(null),
    [draft, setDraft] = useState<{
      quote: CartQuote;
      advisor: Advisor;
      expiresAt: string;
    } | null>(null);
  const [addressId, setAddressId] = useState(addresses[0]?.id || ""),
    [note, setNote] = useState(""),
    [ack, setAck] = useState(false),
    [revoke, setRevoke] = useState<Grant | null>(null),
    [reason, setReason] = useState("");
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function refresh() {
    const [next, basket] = await Promise.all([
      api<Info>("/shop/assistance"),
      api<CartQuote>("/cart"),
    ]);
    setInfo(next);
    setCart(basket);
  }
  useEffect(() => {
    let active = true;
    const update = () => refresh().catch((e) => active && setError(e.message));
    void update();
    const timer = setInterval(update, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session.user.id]);
  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e: any) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <View style={A.wrap}>
      <View style={{ gap: 8 }}>
        <Text style={A.title}>Votre conseiller, avec votre accord.</Text>
        <Text style={S.muted}>
          Une aide pour préparer une demande de devis. Vous gardez la décision
          de commander.
        </Text>
      </View>
      {error && !draft && !revoke ? <Notice error>{error}</Notice> : null}
      {!info ? (
        <Button variant="secondary" loading={busy} onPress={() => run(refresh)}>
          Actualiser le conseiller
        </Button>
      ) : (
        <>
          <View style={A.advisor}>
            <Icon name="person-outline" color={C.green} />
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={S.label}>
                {info.advisor?.name || "Aucun conseiller affecté"}
              </Text>
              <Text style={S.small}>
                {info.advisor
                  ? "Conseiller de " + session.user.shopName
                  : "Le grossiste doit affecter une personne à votre magasin."}
              </Text>
            </View>
          </View>
          <Notice>
            Le conseiller peut transmettre une seule demande pour les produits,
            quantités et l’adresse autorisés. Il ne peut ni accepter le devis,
            ni payer ou réceptionner à votre place.
          </Notice>
          {!info.canAuthorize ? (
            <Text style={S.muted}>
              Le propriétaire ou un responsable du magasin peut donner cette
              autorisation. Vous pouvez consulter les demandes ci-dessous.
            </Text>
          ) : !addresses.length ? (
            <Button variant="secondary" onPress={onShop}>
              Renseigner l’adresse du magasin
            </Button>
          ) : !draft ? (
            <>
              <Text style={S.small}>
                Votre panier personnel contient {cart?.items.length || 0}{" "}
                produit{cart?.items.length !== 1 ? "s" : ""}. L’autorisation
                conserve votre panier et ne crée pas encore de commande.
              </Text>
              <Button
                variant="ink"
                loading={busy}
                disabled={
                  !info.advisor ||
                  !cart?.items.length ||
                  (info.validUntil != null &&
                    Date.parse(info.validUntil) < Date.now() + 5 * 60000)
                }
                onPress={() =>
                  run(async () => {
                    const [latest, quote] = await Promise.all([
                      api<Info>("/shop/assistance"),
                      api<CartQuote>("/cart"),
                    ]);
                    setInfo(latest);
                    setCart(quote);
                    if (!latest.advisor || !latest.canAuthorize)
                      throw new Error(
                        "Le conseiller ou vos droits ont changé. Actualisez ce dossier.",
                      );
                    if (!quote.items.length)
                      throw new Error(
                        "Ajoutez d’abord des produits à votre panier.",
                      );
                    const expiry = Math.min(
                      Date.now() + 24 * 3600000,
                      latest.validUntil
                        ? Date.parse(latest.validUntil)
                        : Infinity,
                    );
                    if (expiry <= Date.now() + 5 * 60000)
                      throw new Error(
                        "Votre accès expire bientôt. Demandez un nouvel accès au grossiste.",
                      );
                    setDraft({
                      quote,
                      advisor: latest.advisor,
                      expiresAt: new Date(expiry).toISOString(),
                    });
                    setRevoke(null);
                    setAck(false);
                    setNote("");
                  })
                }
              >
                Vérifier les produits à autoriser
              </Button>
            </>
          ) : (
            <View style={A.form}>
              <Text style={A.section}>Autoriser {draft.advisor.name}</Text>
              {draft.quote.items.map((item) => (
                <View key={item.product.id} style={A.line}>
                  <Text style={[S.text, { flex: 1 }]}>{item.product.name}</Text>
                  <Text style={S.label}>
                    {item.quantity} unité{item.quantity !== 1 ? "s" : ""}
                  </Text>
                </View>
              ))}
              <Text style={S.small}>
                Le prix définitif et les frais seront présentés dans le devis du
                grossiste. Aucune promotion ou quantité offerte n’est promise
                par cette autorisation.
              </Text>
              <Text style={S.label}>Adresse autorisée</Text>
              {addresses.map((a) => (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityLabel={a.label + " · " + a.street}
                  accessibilityState={{
                    checked: addressId === a.id,
                    disabled: busy,
                  }}
                  disabled={busy}
                  onPress={() => {
                    setAddressId(a.id);
                    setAck(false);
                  }}
                  style={[
                    A.address,
                    { backgroundColor: addressId === a.id ? C.pale : C.white },
                  ]}
                >
                  <Icon
                    name={
                      addressId === a.id
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    color={C.green}
                  />
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={S.label}>{a.label}</Text>
                    <Text style={S.small}>
                      {a.street}, {a.commune}, {a.wilaya}
                    </Text>
                  </View>
                </Pressable>
              ))}
              <Field
                label="Précision pour le conseiller · facultative"
                value={note}
                onChangeText={(value) => {
                  setNote(value);
                  setAck(false);
                }}
                editable={!busy}
                multiline
              />
              <Text style={S.small}>
                Une utilisation, avant le {date(draft.expiresAt, true)}. Vous
                pouvez révoquer l’autorisation tant que la demande n’est pas
                transmise.
              </Text>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: ack, disabled: busy }}
                disabled={busy}
                onPress={() => setAck(!ack)}
                style={A.consent}
              >
                <Icon
                  name={ack ? "checkbox" : "square-outline"}
                  color={C.green}
                />
                <Text style={[S.text, { flex: 1 }]}>
                  J’autorise {draft.advisor.name} à transmettre cette demande
                  exacte de devis pour {session.user.shopName}.
                </Text>
              </Pressable>
              {error ? <Notice error>{error}</Notice> : null}
              <Button
                variant="ink"
                loading={busy}
                disabled={!ack || !addressId}
                onPress={() =>
                  run(async () => {
                    const result = await post<Info>("/shop/assistance", {
                      advisorId: draft.advisor.id,
                      portfolioVersion: draft.advisor.version,
                      addressId,
                      items: draft.quote.items.map((i) => ({
                        productId: i.product.id,
                        quantity: i.quantity,
                      })),
                      note,
                      expiresAt: draft.expiresAt,
                    });
                    setInfo(result);
                    setDraft(null);
                    setAck(false);
                    onNotice(
                      "Autorisation enregistrée. Aucune commande n’est encore acceptée.",
                    );
                  })
                }
              >
                Autoriser une demande de devis
              </Button>
              <Button
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setDraft(null);
                  setError("");
                }}
              >
                Garder mon panier sans autoriser
              </Button>
            </View>
          )}
          <View style={{ gap: 16 }}>
            <Text style={A.section}>Vos autorisations</Text>
            {!info.items.length ? (
              <Text style={S.muted}>
                Aucune demande assistée autorisée pour le moment.
              </Text>
            ) : (
              info.items.map((grant) => (
                <View key={grant.id} style={A.record}>
                  <Text style={S.label}>{states[grant.status]}</Text>
                  <Text style={S.small}>
                    {grant.issuerName} → {grant.advisorName}
                  </Text>
                  {grant.items.map((item) => (
                    <Text key={item.productId} style={S.text}>
                      {item.quantity} × {item.name}
                    </Text>
                  ))}
                  <Text style={S.small}>
                    {grant.address.street}, {grant.address.commune} ·{" "}
                    {date(grant.expiresAt, true)}
                  </Text>
                  {grant.note ? (
                    <Text style={S.small}>{grant.note}</Text>
                  ) : null}
                  {grant.orderId ? (
                    <Button
                      small
                      style={{ minHeight: 44 }}
                      variant="secondary"
                      onPress={onOrders}
                    >
                      Voir les demandes du magasin
                    </Button>
                  ) : null}
                  {info.canAuthorize &&
                  grant.status === "AVAILABLE" &&
                  revoke?.id !== grant.id ? (
                    <Button
                      small
                      style={{ minHeight: 44 }}
                      variant="ghost"
                      disabled={busy}
                      onPress={() => {
                        setRevoke(grant);
                        setDraft(null);
                        setReason("");
                        setError("");
                      }}
                    >
                      Révoquer cette autorisation
                    </Button>
                  ) : null}
                  {revoke?.id === grant.id ? (
                    <View style={{ gap: 14 }}>
                      <Field
                        label="Motif de la révocation"
                        value={reason}
                        onChangeText={setReason}
                        editable={!busy}
                      />
                      {error ? <Notice error>{error}</Notice> : null}
                      <Button
                        variant="danger"
                        disabled={reason.trim().length < 8}
                        loading={busy}
                        onPress={() =>
                          run(async () => {
                            setInfo(
                              await post<Info>(
                                "/shop/assistance/" + grant.id + "/revoke",
                                { version: grant.version, reason },
                              ),
                            );
                            setRevoke(null);
                            onNotice(
                              "Autorisation révoquée. Le conseiller ne peut plus la transmettre.",
                            );
                          })
                        }
                      >
                        Confirmer la révocation
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onPress={() => {
                          setRevoke(null);
                          setError("");
                        }}
                      >
                        Conserver cette autorisation
                      </Button>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </View>
        </>
      )}
    </View>
  );
}
const A = StyleSheet.create({
  wrap: { paddingTop: 16, paddingBottom: 24, gap: 24 },
  title: {
    fontFamily: "Inter",
    fontWeight: "700",
    fontSize: 22,
    lineHeight: 30,
    color: C.ink,
  },
  section: {
    fontFamily: "Inter",
    fontSize: 18,
    lineHeight: 26,
    fontWeight: "700",
    color: C.ink,
  },
  advisor: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  form: { gap: 20, borderTopWidth: 1, borderColor: C.border, paddingTop: 24 },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  address: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderRadius: 12,
    minHeight: 56,
  },
  consent: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    paddingVertical: 16,
    minHeight: 48,
  },
  record: {
    gap: 12,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: C.border,
  },
});
