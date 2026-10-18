import React, { useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api, Claim, date, money, operationKey, Order, post } from "./api";
import { Button, Field, Icon, Notice, Status } from "./components";
import { C, S } from "./theme";

const message = (e: unknown) =>
  e instanceof Error ? e.message : "Action indisponible. Réessayez.";
const integer = (value: string, maximum: number) => {
  const n = Number(value);
  if (!value.trim() || !Number.isSafeInteger(n) || n < 1 || n > maximum)
    throw new Error(`Saisissez une quantité de 1 à ${maximum}.`);
  return n;
};
function ClaimSummary({ claim: c }: { claim: Claim }) {
  return (
    <View style={{ gap: 8 }}>
      <View style={[S.between, { flexWrap: "wrap" }]}>
        <Text style={[S.label, { flex: 1 }]}>{c.productName}</Text>
        <Status value={c.status} />
      </View>
      <Text style={S.muted}>
        {c.quantity} unité{c.quantity > 1 ? "s" : ""} · {c.reason}
      </Text>
      <Text style={S.small}>{date(c.createdAt, true)}</Text>
      {c.resolutionNote ? <Text style={S.text}>{c.resolutionNote}</Text> : null}
      {c.receivedQuantity > 0 ? (
        <Text style={S.small}>
          {c.receivedQuantity} reçue{c.receivedQuantity > 1 ? "s" : ""} en
          retour · {c.inspectedQuantity} contrôlée
          {c.inspectedQuantity > 1 ? "s" : ""}
        </Text>
      ) : null}
      {c.creditedAmount > 0 ? (
        <Text style={[S.label, { color: C.green }]}>
          Avoir accordé : {money(c.creditedAmount)}
        </Text>
      ) : null}
    </View>
  );
}
export function MerchantClaims({
  order,
  onUpdated,
  onNotice,
  canWrite = true,
}: {
  order: Order;
  onUpdated: (order: Order) => void;
  onNotice: (text: string) => void;
  canWrite?: boolean;
}) {
  const [open, setOpen] = useState(false),
    [productId, setProduct] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [reason, setReason] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const claims = order.claims || [];
  const eligible = order.items
    .map((item) => ({
      ...item,
      claimable: Math.max(
        0,
        (item.acceptedQuantity || 0) -
          claims
            .filter(
              (c) => c.productId === item.productId && c.status !== "REJECTED",
            )
            .reduce((n, c) => n + c.quantity, 0),
      ),
    }))
    .filter((item) => item.claimable > 0);
  const available = eligible.find((item) => item.productId === productId);
  if (
    !["DELIVERED", "PARTIALLY_DELIVERED"].includes(order.status) &&
    !claims.length
  )
    return null;
  async function submit() {
    setError("");
    setBusy(true);
    try {
      if (!available) throw new Error("Choisissez le produit concerné.");
      const qty = integer(quantity, available.claimable);
      if (reason.trim().length < 3)
        throw new Error("Décrivez le problème rencontré.");
      await post(`/orders/${order.id}/claims`, {
        productId,
        quantity: qty,
        reason: reason.trim(),
      });
      onUpdated(await api<Order>(`/orders/${order.id}`));
      setOpen(false);
      setReason("");
      setProduct("");
      setQuantity("1");
      onNotice("Votre réclamation a été transmise au grossiste.");
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[S.panel, { gap: 18 }]}>
      <View style={S.between}>
        <Text style={S.subheading}>Après la livraison</Text>
        <Icon name="chatbubble-ellipses-outline" color={C.muted} />
      </View>
      {claims.map((c) => (
        <View
          key={c.id}
          style={{ borderTopWidth: 1, borderColor: C.border, paddingTop: 16 }}
        >
          <ClaimSummary claim={c} />
        </View>
      ))}
      {canWrite && eligible.length && !open ? (
        <Button
          variant="secondary"
          icon="chatbubble-outline"
          onPress={() => setOpen(true)}
        >
          Signaler un problème
        </Button>
      ) : null}
      {canWrite && open ? (
        <View style={{ gap: 16 }}>
          <Text style={S.muted}>
            Choisissez un produit reçu. Le grossiste examinera votre demande
            avant tout retour ou avoir.
          </Text>
          {eligible.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{ checked: productId === item.productId }}
              accessibilityLabel={item.name}
              onPress={() => {
                setProduct(item.productId);
                setQuantity("1");
              }}
              style={({ pressed }) => ({
                padding: 14,
                borderWidth: 1,
                borderColor: productId === item.productId ? C.green : C.border,
                borderRadius: 9,
                backgroundColor: pressed ? C.pale : C.white,
                flexDirection: "row",
                gap: 10,
                alignItems: "center",
                minHeight: 48,
              })}
            >
              <Icon
                name={
                  productId === item.productId
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                color={productId === item.productId ? C.green : C.muted}
              />
              <View style={{ flex: 1 }}>
                <Text style={S.label}>{item.name}</Text>
                <Text style={S.small}>
                  {item.claimable} unité{item.claimable > 1 ? "s" : ""} éligible
                  {item.claimable > 1 ? "s" : ""}
                </Text>
              </View>
            </Pressable>
          ))}
          <Field
            label="Quantité concernée"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
          />
          <Field
            label="Décrivez le problème"
            value={reason}
            onChangeText={setReason}
            multiline
            placeholder="Produit abîmé, défaut constaté…"
          />
          {error ? <Notice error>{error}</Notice> : null}
          <Button
            loading={busy}
            disabled={!available || !reason.trim()}
            onPress={submit}
          >
            Envoyer ma réclamation
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onPress={() => {
              setOpen(false);
              setError("");
            }}
          >
            Annuler
          </Button>
        </View>
      ) : null}
      {!eligible.length && !claims.length ? (
        <Text style={S.muted}>
          Aucun produit reçu à signaler sur cette commande.
        </Text>
      ) : null}
      {(order.creditTotal || 0) > 0 ? (
        <Text style={[S.label, { color: C.green }]}>
          Total des avoirs : {money(order.creditTotal)}
        </Text>
      ) : null}
    </View>
  );
}
type Run = (
  key: string,
  task: () => Promise<unknown>,
  notice: string,
) => Promise<void>;
export function AdminClaims({
  order,
  busy,
  run,
  reportError,
}: {
  order: Order;
  busy: string;
  run: Run;
  reportError: (text: string) => void;
}) {
  if (!order.claims?.length) return null;
  return (
    <View style={[S.panel, { gap: 20 }]}>
      <View style={S.between}>
        <Text style={S.subheading}>Réclamations et retours</Text>
        <Text style={S.small}>{order.claims.length}</Text>
      </View>
      {order.claims.map((claim) => (
        <AdminClaim
          key={claim.id}
          claim={claim}
          order={order}
          busy={busy}
          run={run}
          reportError={reportError}
        />
      ))}
      {(order.creditTotal || 0) > 0 ? (
        <View
          style={[
            S.between,
            { borderTopWidth: 1, borderColor: C.border, paddingTop: 16 },
          ]}
        >
          <Text style={S.label}>Avoirs accordés</Text>
          <Text style={[S.label, { color: C.green }]}>
            {money(order.creditTotal)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
function AdminClaim({
  claim: c,
  order,
  busy,
  run,
  reportError,
}: {
  claim: Claim;
  order: Order;
  busy: string;
  run: Run;
  reportError: (text: string) => void;
}) {
  const [action, setAction] = useState(""),
    [quantity, setQuantity] = useState("1"),
    [note, setNote] = useState(""),
    [amount, setAmount] = useState(""),
    [disposition, setDisposition] = useState("RESTOCK");
  const key = useRef(operationKey());
  useEffect(() => {
    key.current = operationKey();
  }, [amount, note]);
  const toReceive = c.quantity - c.receivedQuantity,
    toInspect = c.receivedQuantity - c.inspectedQuantity;
  const line = order.items.find((x) => x.productId === c.productId),
    maximumCredit = Math.max(
      0,
      Math.round(
        (c.receivedQuantity * (line?.unitPrice || 0) - c.creditedAmount) * 100,
      ) / 100,
    );
  const switchAction = (next: string) => {
    setAction(next);
    setNote("");
    setQuantity("1");
    setAmount("");
  };
  const submit = () => {
    try {
      if (note.trim().length < 3)
        throw new Error("Ajoutez un motif ou une observation précise.");
      let body: any, path: string;
      if (action === "ACCEPTED" || action === "REJECTED") {
        path = "resolve";
        body = { status: action, note: note.trim() };
      } else if (action === "receive") {
        path = "receive";
        body = { quantity: integer(quantity, toReceive), note: note.trim() };
      } else if (action === "inspect") {
        path = "inspect";
        body = {
          quantity: integer(quantity, toInspect),
          disposition,
          reason: note.trim(),
        };
      } else {
        const n = Number(amount.replace(",", "."));
        if (
          !amount.trim() ||
          !Number.isFinite(n) ||
          n <= 0 ||
          Math.round(n * 100) / 100 !== n ||
          n > maximumCredit
        )
          throw new Error(
            `Saisissez un avoir positif, au maximum ${money(maximumCredit)}.`,
          );
        path = "credit";
        body = { amount: n, reason: note.trim(), idempotencyKey: key.current };
      }
      run(
        `claim-${c.id}`,
        async () => {
          await post(`/admin/claims/${c.id}/${path}`, body);
          setAction("");
          setNote("");
        },
        action === "credit"
          ? "Avoir enregistré. Vérifiez le solde dans Encaissements."
          : "Opération de réclamation enregistrée.",
      );
    } catch (e) {
      reportError(message(e));
    }
  };
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderColor: C.border,
        paddingTop: 20,
        gap: 16,
      }}
    >
      <ClaimSummary claim={c} />
      {!action ? (
        <View style={[S.row, { flexWrap: "wrap" }]}>
          {c.status === "OPEN" ? (
            <>
              <Button
                small
                variant="secondary"
                disabled={!!busy}
                onPress={() => switchAction("ACCEPTED")}
              >
                Accepter le retour
              </Button>
              <Button
                small
                variant="ghost"
                disabled={!!busy}
                onPress={() => switchAction("REJECTED")}
              >
                Refuser
              </Button>
            </>
          ) : null}
          {c.status === "ACCEPTED" && toReceive > 0 ? (
            <Button
              small
              variant="secondary"
              disabled={!!busy}
              onPress={() => switchAction("receive")}
            >
              Recevoir le retour
            </Button>
          ) : null}
          {toInspect > 0 ? (
            <Button
              small
              variant="secondary"
              disabled={!!busy}
              onPress={() => switchAction("inspect")}
            >
              Contrôler les unités
            </Button>
          ) : null}
          {c.status === "ACCEPTED" && maximumCredit > 0 ? (
            <Button
              small
              variant="secondary"
              disabled={!!busy}
              onPress={() => switchAction("credit")}
            >
              Accorder un avoir
            </Button>
          ) : null}
        </View>
      ) : (
        <View
          style={{
            gap: 14,
            backgroundColor: C.bg,
            padding: 16,
            borderRadius: 10,
          }}
        >
          <Text style={S.label}>
            {action === "ACCEPTED"
              ? "Autoriser le retour"
              : action === "REJECTED"
                ? "Refuser la réclamation"
                : action === "receive"
                  ? "Confirmer la réception physique"
                  : action === "inspect"
                    ? "Contrôler la marchandise"
                    : "Accorder un avoir commercial"}
          </Text>
          {action === "receive" || action === "inspect" ? (
            <Field
              label={`Quantité (${action === "receive" ? toReceive : toInspect} maximum)`}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
            />
          ) : null}
          {action === "inspect" ? (
            <View style={[S.row, { flexWrap: "wrap" }]}>
              <Button
                variant={disposition === "RESTOCK" ? "primary" : "secondary"}
                onPress={() => setDisposition("RESTOCK")}
              >
                Remettre en stock
              </Button>
              <Button
                variant={disposition === "WRITE_OFF" ? "primary" : "secondary"}
                onPress={() => setDisposition("WRITE_OFF")}
              >
                Constater une perte
              </Button>
            </View>
          ) : null}
          {action === "credit" ? (
            <>
              <Text style={S.muted}>
                Maximum {money(maximumCredit)}, selon les unités revenues et le
                prix accepté. Le remboursement réel s’enregistre ensuite dans
                Encaissements.
              </Text>
              <Field
                label="Montant de l’avoir en DA"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />
            </>
          ) : null}
          <Field
            label="Motif ou observation"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <View style={[S.row, { flexWrap: "wrap" }]}>
            <Button
              loading={busy === `claim-${c.id}`}
              disabled={!!busy}
              onPress={submit}
            >
              Confirmer
            </Button>
            <Button
              variant="ghost"
              disabled={!!busy}
              onPress={() => setAction("")}
            >
              Revenir
            </Button>
          </View>
        </View>
      )}
    </View>
  );
}
