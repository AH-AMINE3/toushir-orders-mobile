import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { api, date, money, operationKey, post, type Order } from "./api";
import { Button, Field, Icon, Notice } from "./components";
import { C, S } from "./theme";

const states: Record<string, string> = {
  PENDING: "Votre accord est attendu",
  ACCEPTED: "Modification acceptée",
  REJECTED: "Modification refusée",
  WITHDRAWN: "Proposition retirée",
  EXPIRED: "Proposition expirée",
  STALE: "La commande a changé",
  CLOSED: "Décision enregistrée",
};
function Terms({ value, title }: { value: any; title: string }) {
  return (
    <View style={A.terms}>
      <Text style={S.label}>{title}</Text>
      {value.items.map((line: any) => (
        <View style={A.line} key={line.productId}>
          <View style={{ flex: 1, gap: 5 }}>
            <Text style={S.label}>{line.name}</Text>
            <Text style={S.small}>
              {line.quantity} unités · {money(line.unitPrice)} / unité
              {line.caseSize > 1 ? ` · colis de ${line.caseSize}` : ""}
            </Text>
            {line.campaignTitle ? (
              <Text style={S.small}>
                {line.campaignTitle}
                {line.giftQuantity
                  ? ` · ${line.giftQuantity} × ${line.giftProductName} offert(s)`
                  : ""}
              </Text>
            ) : null}
          </View>
          <Text style={S.label}>{money(line.lineTotal)}</Text>
        </View>
      ))}
      {value.promotions?.items
        ?.filter(
          (promotion: any) =>
            promotion.quoteVersion === value.quoteVersion &&
            !["SUPERSEDED", "CANCELLED"].includes(promotion.status),
        )
        .map((promotion: any) => (
          <Text style={S.small} key={promotion.id}>
            {promotion.campaignTitle}
            {promotion.kind === "FREE_GOODS" && promotion.giftQuantity
              ? ` · ${promotion.giftQuantity} × ${promotion.giftProductName} offert(s)`
              : " · remise incluse dans le prix"}
          </Text>
        ))}
      <View style={S.between}>
        <Text style={S.muted}>Marchandises</Text>
        <Text style={S.label}>{money(value.subtotal)}</Text>
      </View>
      <View style={S.between}>
        <Text style={S.muted}>Livraison</Text>
        <Text style={S.label}>{money(value.deliveryFee)}</Text>
      </View>
      <View
        style={[
          S.between,
          { paddingTop: 10, borderTopWidth: 1, borderColor: C.border },
        ]}
      >
        <Text style={S.label}>Total</Text>
        <Text style={[S.subheading, { color: C.green }]}>
          {money(value.total)}
        </Text>
      </View>
    </View>
  );
}

export default function OrderAmendments({
  orderId,
  updatedAt,
  canWrite,
  onUpdated,
  onNotice,
}: {
  orderId: string;
  updatedAt: string;
  canWrite: boolean;
  onUpdated: (order: Order) => void;
  onNotice: (message: string) => void;
}) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [review, setReview] = useState<any>(null),
    [ack, setAck] = useState(false),
    [rejecting, setRejecting] = useState(false),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    keys = useRef<Record<string, string>>({});
  const refresh = async () => {
    const result = await api(`/orders/${orderId}/amendments`);
    setData(result);
    return result;
  };
  useEffect(() => {
    let active = true;
    const update = () =>
      api(`/orders/${orderId}/amendments`)
        .then((result) => {
          if (active) {
            setData(result);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    void update();
    const timer = setInterval(update, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orderId, updatedAt]);
  async function decide(action: "accept" | "reject") {
    if (!review || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const slot = `${review.id}-${review.version}-${action}`;
      keys.current[slot] ||= operationKey();
      const result = await post<{ order: Order }>(
        `/orders/${orderId}/amendments/${review.id}/${action}`,
        {
          version: review.version,
          termsHash: action === "accept" ? review.termsHash : undefined,
          reason: action === "reject" ? reason.trim() : undefined,
          idempotencyKey: keys.current[slot],
        },
      );
      onUpdated(result.order);
      setReview(null);
      setAck(false);
      setRejecting(false);
      setReason("");
      onNotice(
        action === "accept"
          ? "Modification acceptée. Les produits et le montant de votre commande sont actualisés."
          : "Modification refusée. Votre commande initiale reste en vigueur.",
      );
      try {
        await refresh();
      } catch {
        setError(
          "Votre décision est enregistrée. Actualisez pour consulter son historique.",
        );
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (data && !data.items.length && !error) return null;
  const current = review
    ? data?.items.find(
        (item: any) =>
          item.id === review.id &&
          item.version === review.version &&
          item.termsHash === review.termsHash,
      )
    : null;
  const canAccept = !!(canWrite && current?.canAccept),
    canReject = !!(canWrite && current?.canReject);
  return (
    <View style={A.wrap}>
      <View style={S.row}>
        <Icon name="swap-horizontal-outline" color={C.green} />
        <Text style={[S.subheading, { flex: 1 }]}>
          Une modification à examiner
        </Text>
      </View>
      <Text style={S.muted}>
        Le grossiste peut proposer un autre panier. Votre commande reste
        inchangée jusqu’à votre accord explicite.
      </Text>
      {error ? <Notice error>{error}</Notice> : null}
      {!data || error ? (
        <Button
          variant="secondary"
          disabled={busy}
          onPress={() => {
            setError("");
            void refresh().catch((e) => setError(e.message));
          }}
        >
          Actualiser les propositions
        </Button>
      ) : null}
      {data?.items.map((proposal: any) => (
        <View style={A.record} key={proposal.id}>
          <Text
            style={[S.label, { color: proposal.canAccept ? C.green : C.ink }]}
          >
            {states[
              proposal.status !== "PENDING"
                ? proposal.status
                : proposal.applicability
            ] ||
              states[proposal.status] ||
              proposal.status}
          </Text>
          <Text style={S.small}>
            {proposal.proposerName || "Votre grossiste"} ·{" "}
            {date(proposal.proposedAt, true)}
          </Text>
          <Text style={S.text}>{proposal.reason}</Text>
          <View style={S.between}>
            <Text style={S.muted}>Nouveau total proposé</Text>
            <Text style={S.label}>{money(proposal.after.total)}</Text>
          </View>
          <Text style={S.small}>
            Valable jusqu’au {date(proposal.expiresAt, true)}
          </Text>
          {proposal.decidedAt ? (
            <Text style={S.small}>
              {proposal.decisionName || "Décision enregistrée"} ·{" "}
              {date(proposal.decidedAt, true)}
              {proposal.decisionReason ? " · " + proposal.decisionReason : ""}
            </Text>
          ) : null}
          {review?.id !== proposal.id ? (
            <Button
              variant="secondary"
              disabled={busy}
              onPress={() => {
                setReview(proposal);
                setAck(false);
                setRejecting(false);
                setReason("");
                setError("");
              }}
            >
              Comparer les produits et les prix
            </Button>
          ) : (
            <View style={{ gap: 15 }}>
              <Terms
                title="Commande lors de la proposition"
                value={review.before}
              />
              <Terms title="Conditions proposées" value={review.after} />
              {!canWrite ? (
                <Notice>
                  Vous pouvez consulter cette proposition. Un membre du magasin
                  habilité à commander doit prendre la décision.
                </Notice>
              ) : !canAccept && !canReject ? (
                <Notice>
                  Cette proposition ne peut plus être décidée. La commande ou
                  les conditions ont évolué ; actualisez les informations.
                </Notice>
              ) : (
                <>
                  <Text style={S.small}>
                    Les quantités, prix et avantages ci-dessus sont ceux de
                    cette proposition. Le serveur vérifie encore la commande,
                    les conditions et le stock lors de votre accord.
                  </Text>
                  {canAccept && !rejecting ? (
                    <>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: ack, disabled: busy }}
                        accessibilityLabel="J’ai vérifié les produits, quantités, prix et nouveau total"
                        disabled={busy}
                        onPress={() => setAck(!ack)}
                        style={A.consent}
                      >
                        <View
                          style={[
                            A.checkbox,
                            ack && {
                              backgroundColor: C.green,
                              borderColor: C.green,
                            },
                          ]}
                        >
                          {ack ? (
                            <Icon name="checkmark" color={C.white} size={17} />
                          ) : null}
                        </View>
                        <Text style={[S.text, { flex: 1 }]}>
                          J’ai vérifié les produits, quantités, prix et nouveau
                          total.
                        </Text>
                      </Pressable>
                      <Button
                        loading={busy}
                        disabled={!ack || !canAccept}
                        icon="checkmark"
                        onPress={() => void decide("accept")}
                      >
                        Accepter · {money(review.after.total)}
                      </Button>
                    </>
                  ) : null}
                  {canReject ? (
                    rejecting ? (
                      <>
                        <Field
                          label="Motif du refus"
                          value={reason}
                          onChangeText={setReason}
                          multiline
                          maxLength={800}
                          editable={!busy}
                          placeholder="Expliquez au grossiste ce qui ne convient pas."
                        />
                        <Button
                          variant="danger"
                          loading={busy}
                          disabled={reason.trim().length < 8}
                          onPress={() => void decide("reject")}
                        >
                          Confirmer le refus
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={busy}
                          onPress={() => setRejecting(false)}
                        >
                          Revenir à la proposition
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        disabled={busy}
                        onPress={() => setRejecting(true)}
                      >
                        Refuser la modification
                      </Button>
                    )
                  ) : null}
                </>
              )}
              <Button
                variant="ghost"
                disabled={busy}
                onPress={() => {
                  setReview(null);
                  setAck(false);
                  setRejecting(false);
                }}
              >
                Fermer la comparaison
              </Button>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
const A = StyleSheet.create({
  wrap: {
    padding: 20,
    backgroundColor: C.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    gap: 14,
  },
  record: { paddingTop: 18, borderTopWidth: 1, borderColor: C.border, gap: 12 },
  terms: { padding: 15, backgroundColor: C.bg, borderRadius: 12, gap: 14 },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  consent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    minHeight: 48,
    paddingVertical: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: C.muted,
    alignItems: "center",
    justifyContent: "center",
  },
});
