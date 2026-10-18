import React, { useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import {
  api,
  date,
  money,
  operationKey,
  post,
  Product,
  put,
  Session,
} from "./api";
import {
  Button,
  Empty,
  Field,
  FilterPill,
  Icon,
  Notice,
  ProductImage,
} from "./components";
import { C, S } from "./theme";
import { useEngagementLive } from "./realtime";
import { MeasuredProgress, StateArrival } from "./Motion";

type Context = {
  type: "ORDER" | "DELIVERY" | "GIFT";
  id: string;
  subject: string;
};
type Conversation = {
  id: string;
  subject: string;
  contextType: string;
  contextId: string;
  status: string;
  updatedAt: string;
};
type Message = {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  at: string;
};
export function Conversations({
  session,
  initialContext,
  settingsOpen,
}: {
  session: Session;
  initialContext?: Context;
  settingsOpen?: boolean;
}) {
  const canSend =
    session.user.role !== "MERCHANT" || session.user.shop?.canOrder !== false;
  const canManage = session.user.shop?.canManage !== false;
  const [threads, setThreads] = useState<Conversation[]>([]),
    [thread, setThread] = useState<Conversation | null>(null),
    [messages, setMessages] = useState<Message[]>([]),
    [text, setText] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [filter, setFilter] = useState(""),
    [marketing, setMarketing] = useState(false),
    [showSettings, setShowSettings] = useState(false);
  const current = useRef<string | null>(null),
    key = useRef(operationKey()),
    loading = useRef(false);
  async function refresh() {
    if (loading.current) return;
    loading.current = true;
    try {
      const data = await api<{ items: Conversation[] }>("/conversations");
      setThreads(data.items);
      if (current.current) {
        const detail = await api<{
          conversation: Conversation;
          items: Message[];
        }>(`/conversations/${current.current}/messages`);
        setThread(detail.conversation);
        setMessages(detail.items);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      loading.current = false;
    }
  }
  const live = useEngagementLive(session.user.id, refresh);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [session.user.id]);
  useEffect(() => {
    if (initialContext) create(initialContext);
  }, [initialContext?.id]);
  useEffect(() => {
    if (settingsOpen === undefined) return;
    setShowSettings(settingsOpen);
    if (settingsOpen)
      api<any>("/preferences/marketing")
        .then((p) => setMarketing(!!p.optIn))
        .catch((e) => setError(e.message));
  }, [settingsOpen]);
  async function open(t: Conversation) {
    current.current = t.id;
    setThread(t);
    setError("");
    setMessages([]);
    try {
      const result = await api<{ items: Message[] }>(
        `/conversations/${t.id}/messages`,
      );
      setMessages(result.items);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function create(context?: Context) {
    if (!canSend) {
      try {
        const available = await api<{ items: Conversation[] }>(
          "/conversations",
        );
        const existing = available.items.find(
          (t) =>
            t.contextType === (context?.type || "GENERAL") &&
            (!context?.id || t.contextId === context.id),
        );
        if (existing) await open(existing);
        else
          setError(
            "Aucune conversation ouverte pour ce dossier. Votre accès est en lecture seule.",
          );
      } catch (e: any) {
        setError(e.message);
      }
      return;
    }
    setBusy(true);
    setError("");
    try {
      const next = await post<Conversation>("/conversations", {
        contextType: context?.type || "GENERAL",
        contextId: context?.id,
        subject: context?.subject || "Votre conseiller Toushir",
      });
      await open(next);
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function send() {
    if (!canSend || !thread || !text.trim()) return;
    setBusy(true);
    setError("");
    try {
      await post(`/conversations/${thread.id}/messages`, {
        text: text.trim(),
        internal: false,
        idempotencyKey: key.current,
      });
      setText("");
      key.current = operationKey();
      await refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={E.wrap}>
      {error ? <Notice error>{error}</Notice> : null}
      {thread ? (
        <>
          <View style={S.between}>
            <Button
              variant="ghost"
              icon="arrow-back"
              label="Retour aux conversations"
              onPress={() => {
                current.current = null;
                setThread(null);
                setText("");
                key.current = operationKey();
              }}
            />
            <Text style={[S.label, { flex: 1 }]}>{thread.subject}</Text>
            <Text style={S.small}>
              {thread.status === "CLOSED" ? "Clôturée" : "Ouverte"}
            </Text>
          </View>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                E.bubble,
                m.senderId === session.user.id
                  ? { backgroundColor: C.pale, alignSelf: "flex-end" }
                  : {},
              ]}
            >
              <Text style={[S.small, { color: C.green }]}>{m.senderName}</Text>
              <Text selectable style={S.text}>
                {m.text}
              </Text>
              <Text style={S.small}>{date(m.at, true)} · envoyé</Text>
            </View>
          ))}
          {!messages.length ? (
            <Text style={S.muted}>
              Cette conversation n’a pas encore de message.
            </Text>
          ) : null}
          {thread.status === "OPEN" && canSend ? (
            <>
              <Field
                label="Votre message"
                value={text}
                onChangeText={setText}
                multiline
                maxLength={5000}
              />
              <Button
                icon="send-outline"
                disabled={!text.trim()}
                loading={busy}
                onPress={send}
              >
                Envoyer dans l’application
              </Button>
            </>
          ) : (
            <Notice>
              {canSend
                ? "Cette conversation est clôturée. Votre équipe peut la rouvrir."
                : "Vous consultez cette conversation en lecture seule."}
            </Notice>
          )}
        </>
      ) : (
        <>
          <View style={S.between}>
            <View style={[S.row, { gap: 6, flexWrap: "wrap" }]}>
              {[
                ["", "Tous"],
                ["ORDER", "Commandes"],
                ["DELIVERY", "Livreur"],
              ].map(([id, label]) => (
                <FilterPill
                  key={id}
                  selected={filter === id}
                  onPress={() => setFilter(id)}
                >
                  {label}
                </FilterPill>
              ))}
            </View>
            {session.user.role === "MERCHANT" &&
            canManage &&
            settingsOpen === undefined ? (
              <Button
                variant="ghost"
                icon="settings-outline"
                label="Préférences de communication"
                onPress={async () => {
                  setShowSettings(!showSettings);
                  try {
                    const p = await api<any>("/preferences/marketing");
                    setMarketing(!!p.optIn);
                  } catch (e: any) {
                    setError(e.message);
                  }
                }}
              />
            ) : null}
          </View>
          {showSettings ? (
            <View style={E.panel}>
              <Text style={S.label}>Recevoir les offres commerciales</Text>
              <View style={S.row}>
                <Text style={[S.muted, { flex: 1 }]}>
                  Autoriser les campagnes promotionnelles dans l’application.
                </Text>
                <Switch
                  accessibilityLabel="Recevoir les offres commerciales"
                  value={marketing}
                  disabled={!canManage}
                  onValueChange={async (value) => {
                    try {
                      await put("/preferences/marketing", { optIn: value });
                      setMarketing(value);
                    } catch (e: any) {
                      setError(e.message);
                    }
                  }}
                  trackColor={{ true: C.green }}
                />
              </View>
              <Text style={S.small}>
                Les messages de service restent disponibles.
              </Text>
            </View>
          ) : null}
          {threads
            .filter((t) => !filter || t.contextType === filter)
            .map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="button"
                onPress={() => open(t)}
                style={E.thread}
              >
                <View style={E.avatar}>
                  <Icon
                    name={
                      t.contextType === "DELIVERY"
                        ? "car-outline"
                        : t.contextType === "GIFT"
                          ? "gift-outline"
                          : "chatbubble-outline"
                    }
                    color={C.green}
                  />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={S.label}>{t.subject}</Text>
                  <Text style={S.muted}>
                    {t.contextType === "DELIVERY"
                      ? "Livraison"
                      : t.contextType === "ORDER"
                        ? "Commande"
                        : t.contextType === "GIFT"
                          ? "Cadeau"
                          : "Équipe Toushir"}{" "}
                    · {date(t.updatedAt, true)}
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} />
              </Pressable>
            ))}
          {!threads.length ? (
            <Empty
              title="Vos échanges, au même endroit"
              message={
                session.user.role === "DRIVER"
                  ? "Ouvrez un arrêt pour contacter le commerçant à propos de sa livraison."
                  : !canSend
                    ? "Accès en lecture seule. Le propriétaire, un responsable ou un acheteur peut écrire au conseiller. Vous pourrez consulter ici les échanges du magasin."
                    : "Votre conseiller répond à vos questions de réassort."
              }
              icon="chatbubble-outline"
            />
          ) : null}
          {session.user.role === "MERCHANT" && canSend ? (
            <View style={E.panel}>
              <Icon name="chatbubble-outline" size={28} />
              <Text style={E.title}>Une question sur votre réassort ?</Text>
              <Text style={S.muted}>
                Votre conseiller Toushir vous accompagne.
              </Text>
              <Button variant="ink" loading={busy} onPress={() => create()}>
                Écrire à Toushir
              </Button>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

type Campaign = {
  id: string;
  title: string;
  description: string;
  kind: string;
  productId: string;
  minimumQuantity: number;
  discountPercent: number;
  giftQuantity: number;
  goalQuantity: number;
  startsAt: string;
  endsAt: string;
  rewardId?: string;
};
// Brand artwork is used only when the connected product identifies that brand.
function CampaignBrand({
  name,
  rail = false,
}: {
  name: string;
  rail?: boolean;
}) {
  const brand = name.trim().toLocaleLowerCase();
  const artwork =
    brand === "coca-cola" || brand === "coca cola"
      ? require("../assets/figma/mobile-merchant-home-29d02.png")
      : brand === "candia"
        ? require("../assets/figma/mobile-merchant-home-335f4.png")
        : brand === "rouiba"
          ? require("../assets/figma/mobile-merchant-home-15b43.png")
          : brand === "nutella"
            ? require("../assets/figma/mobile-merchant-home-da930.png")
            : null;
  return artwork ? (
    <Image
      source={artwork}
      accessibilityLabel={name}
      contentFit="contain"
      style={{ width: rail ? 65.5 : 84, height: rail ? 28 : 24 }}
    />
  ) : (
    <Text
      numberOfLines={2}
      style={[O.brandName, rail && { textAlign: "center" }]}
    >
      {name || "Votre grossiste"}
    </Text>
  );
}
export function Campaigns({
  session,
  onProduct,
  onNotice,
}: {
  session: Session;
  onProduct: (id: string) => void;
  onNotice: (m: string) => void;
}) {
  const { width } = useWindowDimensions();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [campaignProducts, setCampaignProducts] = useState<Record<string, Product>>(
      {},
    ),
    [selected, setSelected] = useState<Campaign | null>(null),
    [quantity, setQuantity] = useState("1"),
    [kind, setKind] = useState(""),
    [brand, setBrand] = useState(""),
    [loaded, setLoaded] = useState(false),
    [preview, setPreview] = useState<any>(null),
    [progress, setProgress] = useState<any>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const reserveKey = useRef(operationKey());
  async function refresh() {
    try {
      const r = await api<{ items: Campaign[] }>("/campaigns");
      setCampaigns(r.items);
      setLoaded(true);
      setError("");
      if (selected?.kind === "CHALLENGE")
        setProgress(await api(`/campaigns/${selected.id}/progress`));
    } catch (e: any) {
      setError(e.message);
    }
  }
  const live = useEngagementLive(session.user.id, refresh);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [session.user.id, selected?.id]);
  useEffect(() => {
    let active = true;
    const ids = [...new Set(campaigns.map((c) => c.productId))].slice(0, 24);
    Promise.allSettled(ids.map((id) => api<Product>(`/products/${id}`))).then(
      (results) => {
        if (active)
          setCampaignProducts(
            Object.fromEntries(
              results.flatMap((result, index) =>
                result.status === "fulfilled"
                  ? [[ids[index], result.value]]
                  : [],
              ),
            ),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [campaigns.map((c) => c.productId).join("|")]);
  async function choose(c: Campaign) {
    setSelected(c);
    setQuantity(String(c.minimumQuantity || 1));
    setPreview(null);
    setProgress(null);
    setError("");
    reserveKey.current = operationKey();
    if (c.kind === "CHALLENGE")
      try {
        setProgress(await api(`/campaigns/${c.id}/progress`));
      } catch (e: any) {
        setError(e.message);
      }
  }
  const brands = [
    ...new Set(
      campaigns
        .map((c) => campaignProducts[c.productId]?.brand)
        .filter((name): name is string => !!name),
    ),
  ];
  const visibleCampaigns = campaigns
    .filter(
      (c) =>
        (!kind || c.kind === kind) &&
        (!brand || campaignProducts[c.productId]?.brand === brand),
    )
    .sort(
      (a, b) =>
        (({ DISCOUNT: 0, CHALLENGE: 1, FREE_GOODS: 2 })[a.kind] ?? 3) -
        ({ DISCOUNT: 0, CHALLENGE: 1, FREE_GOODS: 2 }[b.kind] ?? 3),
    );
  return (
    <View style={O.wrap}>
      <Text style={O.intro}>Des avantages pour votre réassort.</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        {[
          ["", "Tout"],
          ["DISCOUNT", "Remises"],
          ["FREE_GOODS", "Cadeaux"],
          ["CHALLENGE", "Challenges"],
        ].map(([id, label]) => (
          <Pressable
            key={id}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === id }}
            onPress={() => setKind(id)}
            style={({ pressed }) => [
              O.filter,
              {
                backgroundColor: kind === id ? C.ink : C.bg,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Text
              style={[O.filterText, { color: kind === id ? C.white : C.ink }]}
            >
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {!selected && brands.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 12 }}
        >
          {brands.map((name) => (
            <Pressable
              key={name}
              accessibilityRole="button"
              accessibilityLabel={`Offres ${name}`}
              accessibilityState={{ selected: brand === name }}
              onPress={() => setBrand(brand === name ? "" : name)}
              style={[
                O.brandTile,
                brand === name && {
                  borderColor: C.green,
                  backgroundColor: C.pale,
                },
              ]}
            >
              <CampaignBrand name={name} rail />
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {error ? <Notice error>{error}</Notice> : null}
      {!loaded && !error ? (
        <Text style={S.small}>Chargement des offres…</Text>
      ) : null}
      {selected ? (
        <>
          <Button
            variant="ghost"
            icon="arrow-back"
            onPress={() => setSelected(null)}
          >
            Toutes les offres
          </Button>
          <View style={E.panel}>
            <View style={S.row}>
              <Icon
                name={
                  selected.kind === "CHALLENGE"
                    ? "trophy-outline"
                    : selected.kind === "FREE_GOODS"
                      ? "gift-outline"
                      : "pricetag-outline"
                }
                color={C.green}
                size={25}
              />
              <Text style={[S.label, { color: C.green }]}>
                {selected.kind === "CHALLENGE"
                  ? "Challenge"
                  : selected.kind === "FREE_GOODS"
                    ? "Produits offerts"
                    : "Remise sur quantité"}
              </Text>
            </View>
            <Text style={E.title}>{selected.title}</Text>
            <Text style={S.text}>{selected.description}</Text>
            <Text style={S.small}>
              Du {date(selected.startsAt)} au {date(selected.endsAt)}
            </Text>
            {campaignProducts[selected.productId] ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => onProduct(selected.productId)}
                style={[
                  S.row,
                  {
                    paddingVertical: 12,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: C.border,
                  },
                ]}
              >
                <ProductImage
                  uri={campaignProducts[selected.productId].imageUrl}
                  name={campaignProducts[selected.productId].name}
                  size={68}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={S.label}>
                    {campaignProducts[selected.productId].name}
                  </Text>
                  <Text style={S.small}>
                    Produit concerné ·{" "}
                    {money(campaignProducts[selected.productId].price)} / unité
                  </Text>
                </View>
                <Icon name="chevron-forward" size={18} />
              </Pressable>
            ) : null}
            {selected.kind === "CHALLENGE" ? (
              <>
                <Text style={E.title}>
                  {progress?.eligibleQuantity ?? "—"} /{" "}
                  {progress?.goal ?? selected.goalQuantity}
                </Text>
                <MeasuredProgress
                  value={
                    (progress?.eligibleQuantity || 0) /
                    Math.max(1, progress?.goal ?? selected.goalQuantity)
                  }
                  label={`${progress?.eligibleQuantity || 0} unités éligibles sur ${progress?.goal ?? selected.goalQuantity}`}
                />
                <Text style={S.muted}>
                  Unités acceptées et réglées, après retours pris en compte.
                </Text>
                {progress && !progress.achieved ? (
                  <Text style={S.label}>
                    Encore{" "}
                    {Math.max(
                      0,
                      (progress.goal ?? selected.goalQuantity) -
                        (progress.eligibleQuantity || 0),
                    )}{" "}
                    unités éligibles pour atteindre l’objectif.
                  </Text>
                ) : null}
                {progress?.grant?.status === "GRANTED" &&
                session.user.shop?.canManage !== false ? (
                  <Button
                    loading={busy}
                    onPress={async () => {
                      setBusy(true);
                      try {
                        await post(
                          `/rewards/${progress.grant.rewardId}/reserve`,
                          {
                            grantId: progress.grant.id,
                            idempotencyKey: reserveKey.current,
                          },
                        );
                        onNotice(
                          "Votre cadeau attribué est réservé sans débit de points.",
                        );
                        reserveKey.current = operationKey();
                        await refresh();
                      } catch (e: any) {
                        setError(e.message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Réserver mon cadeau attribué
                  </Button>
                ) : (
                  <Notice>
                    {progress?.achieved
                      ? "Objectif atteint. Votre grossiste doit valider l’attribution après la clôture."
                      : "Votre progression se met à jour avec les commandes éligibles."}
                  </Notice>
                )}
              </>
            ) : (
              <>
                <Field
                  label="Quantité à simuler"
                  keyboardType="number-pad"
                  value={quantity}
                  onChangeText={setQuantity}
                />
                <Button
                  loading={busy}
                  disabled={
                    !Number.isInteger(Number(quantity)) ||
                    Number(quantity) <= 0 ||
                    Number(quantity) > 100000
                  }
                  onPress={async () => {
                    setBusy(true);
                    try {
                      setPreview(
                        await post(`/campaigns/${selected.id}/preview`, {
                          quantity: Number(quantity),
                        }),
                      );
                    } catch (e: any) {
                      setError(e.message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Vérifier les conditions de l’offre
                </Button>
                {preview ? (
                  <StateArrival
                    changeKey={JSON.stringify(preview)}
                    style={{ gap: 12 }}
                  >
                    <Text style={S.label}>
                      {preview.tariffCompatible === false
                        ? "Non cumulable avec votre tarif"
                        : preview.qualifies
                          ? "Conditions atteintes"
                          : "Conditions non atteintes"}
                    </Text>
                    <Text style={S.muted}>
                      {preview.quoteRequired
                        ? "Prix à confirmer dans votre devis."
                        : `Marchandises après réduction : ${money(preview.goodsAfter)}`}
                    </Text>
                    {preview.freeQuantity > 0 ? (
                      <Text style={S.text}>
                        {preview.freeQuantity} produit(s) offert(s), sous
                        réserve du devis confirmé.
                      </Text>
                    ) : null}
                    <Notice>
                      {preview.notice ||
                        "Cette simulation ne modifie pas votre commande. Le grossiste confirme les conditions dans son devis."}
                    </Notice>
                  </StateArrival>
                ) : null}
              </>
            )}
            <Button
              variant="secondary"
              icon="cube-outline"
              onPress={() => onProduct(selected.productId)}
            >
              Voir le produit concerné
            </Button>
          </View>
        </>
      ) : (
        <>
          {visibleCampaigns.map((c, index) => {
            const product = campaignProducts[c.productId];
            const challenge = c.kind === "CHALLENGE";
            const discount = c.kind === "DISCOUNT";
            return (
              <React.Fragment key={c.id}>
                {challenge &&
                (index === 0 ||
                  visibleCampaigns[index - 1].kind !== "CHALLENGE") ? (
                  <Text style={O.sectionTitle}>Votre prochain cadeau</Text>
                ) : null}
                <View
                  style={[
                    O.campaign,
                    {
                      backgroundColor: discount
                        ? C.mint
                        : challenge
                          ? C.rewardBg
                          : C.blueBg,
                    },
                  ]}
                >
                  <View style={S.between}>
                    <View style={O.brandPlate}>
                      <CampaignBrand name={product?.brand || ""} />
                    </View>
                    <Text style={O.publisher}>
                      {challenge ? "Challenge" : discount ? "Remise" : "Cadeau"}{" "}
                      · {session.workspace.name}
                    </Text>
                  </View>
                  <View style={O.benefitRow}>
                    <View style={O.benefit}>
                      <Text
                        numberOfLines={discount ? 1 : undefined}
                        adjustsFontSizeToFit={discount}
                        minimumFontScale={0.65}
                        style={[
                          O.offerValue,
                          discount &&
                            width < 360 && { fontSize: 36, lineHeight: 49 },
                          !discount && O.goalValue,
                        ]}
                      >
                        {discount
                          ? `−${c.discountPercent} %`
                          : challenge
                            ? `Objectif\n${c.goalQuantity.toLocaleString("fr-DZ")} unités`
                            : `${c.giftQuantity} offert${c.giftQuantity === 1 ? "" : "s"}`}
                      </Text>
                      <Text style={O.condition}>
                        {challenge
                          ? c.title
                          : `Dès ${c.minimumQuantity} unités`}
                      </Text>
                      <Text style={O.productName} numberOfLines={1}>
                        {product?.name || c.title}
                      </Text>
                      <Text
                        style={[
                          O.finePrint,
                          {
                            color: challenge
                              ? C.reward
                              : discount
                                ? C.green
                                : C.blue,
                          },
                        ]}
                      >
                        {challenge
                          ? "Après validation des achats éligibles"
                          : "Conditions selon votre panier"}
                      </Text>
                    </View>
                    <View style={O.packshot}>
                      <ProductImage
                        uri={product?.imageUrl}
                        name={product?.name || c.title}
                        style={{
                          width: 100,
                          height: 132,
                          aspectRatio: undefined,
                        }}
                      />
                    </View>
                  </View>
                  <Button
                    onPress={() => choose(c)}
                    label={`${challenge ? "Voir mon challenge" : discount ? "Voir la remise" : "Découvrir le cadeau"} : ${c.title}`}
                    style={{ width: "100%", minHeight: 52 }}
                  >
                    {challenge
                      ? "Voir mon challenge"
                      : discount
                        ? "Voir la remise"
                        : "Découvrir le cadeau"}
                  </Button>
                  <Text style={O.finePrint}>
                    Du {date(c.startsAt)} au {date(c.endsAt)} · Conditions
                    applicables
                  </Text>
                </View>
              </React.Fragment>
            );
          })}
          {loaded && !visibleCampaigns.length ? (
            <Empty
              title={
                campaigns.length
                  ? "Pas encore d’offre dans cette sélection"
                  : "Les prochaines offres arrivent ici"
              }
              message={
                campaigns.length
                  ? "Consultez les autres remises, cadeaux et challenges disponibles."
                  : "Votre grossiste publiera ses offres approuvées et leurs conditions."
              }
              icon="pricetag-outline"
            />
          ) : null}
        </>
      )}
      <Text style={O.finePrint}>
        {live ? "Offres à jour" : "Actualisation automatique"} ·{" "}
        {campaigns.length} offre{campaigns.length === 1 ? "" : "s"}
      </Text>
    </View>
  );
}
export function Loyalty({
  session,
  onNotice,
}: {
  session: Session;
  onNotice: (m: string) => void;
}) {
  const [wallet, setWallet] = useState<any>(null),
    [rewards, setRewards] = useState<any[]>([]),
    [gifts, setGifts] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false);
  const keys = useRef<Record<string, string>>({});
  async function refresh() {
    try {
      const [w, r, g] = await Promise.all([
        api("/loyalty"),
        api<{ items: any[] }>("/rewards"),
        api<{ items: any[] }>("/gift-requests"),
      ]);
      setWallet(w);
      setRewards(r.items);
      setGifts(g.items);
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  const live = useEngagementLive(session.user.id, refresh);
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8000);
    return () => clearInterval(timer);
  }, [session.user.id]);
  const entryLabels: Record<string, string> = {
    ORDER_EARNED: "Points gagnés sur une commande",
    ORDER_CORRECTED: "Régularisation après retour",
    GIFT_RESERVED: "Points réservés pour un cadeau",
    GIFT_FULFILLED: "Cadeau remis",
    GIFT_CANCELLED: "Réservation de cadeau annulée",
  };
  const labels: Record<string, string> = {
    RESERVED: "Réservé",
    READY: "Prêt à retirer",
    FULFILLED: "Remis",
    CANCELLED: "Annulé",
  };
  return (
    <View style={E.wrap}>
      <View style={S.between}>
        <Text style={E.title}>Mes points et cadeaux</Text>
        <Icon name="gift-outline" color={C.green} size={26} />
      </View>
      {error ? <Notice error>{error}</Notice> : null}
      <StateArrival changeKey={wallet?.available ?? "loading"}>
        <View style={[E.panel, { backgroundColor: C.ink }]}>
          <View style={S.between}>
            <Text style={[S.label, { color: "#DCE9E1" }]}>
              Vos points, vos prochains cadeaux
            </Text>
            <Icon name="gift-outline" color={C.action} size={26} />
          </View>
          <Text
            style={[E.title, { fontSize: 42, lineHeight: 52, color: C.white }]}
          >
            {wallet?.available ?? "—"}
          </Text>
          <Text style={[S.small, { color: "#C2D2C8" }]}>
            {wallet?.reserved ?? 0} réservés · {wallet?.spent ?? 0} utilisés
          </Text>
          <Text style={[S.small, { color: "#C2D2C8" }]}>
            {wallet?.rule ||
              "Vos points sont calculés sur les commandes éligibles."}
          </Text>
          {wallet?.correctionDue > 0 ? (
            <Notice error>
              {wallet.correctionDue} points à régulariser. Contactez votre
              grossiste avant une nouvelle remise.
            </Notice>
          ) : null}
          <Button
            variant="secondary"
            icon="refresh-outline"
            disabled={session.user.shop?.canOrder === false}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                setWallet(await post("/loyalty/sync", {}));
                onNotice(
                  "Vos points ont été rapprochés des commandes réglées.",
                );
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Actualiser mes points
          </Button>
        </View>
      </StateArrival>
      <View style={S.between}>
        <Text style={S.subheading}>Choisissez votre cadeau</Text>
        <Text style={S.small}>
          {rewards.length} récompense{rewards.length === 1 ? "" : "s"}
        </Text>
      </View>
      {!rewards.length ? (
        <Empty
          title="Votre prochaine récompense arrive ici"
          message="Votre grossiste publie les cadeaux, leurs stocks et le nombre de points nécessaire."
          icon="gift-outline"
        />
      ) : null}
      {rewards.map((r) => (
        <View key={r.id} style={E.panel}>
          <View style={S.row}>
            {r.imageUrl ? (
              <ProductImage uri={r.imageUrl} name={r.name} size={80} />
            ) : (
              <Icon name="gift-outline" color={C.green} size={32} />
            )}
            <View style={{ flex: 1, gap: 5 }}>
              <Text style={S.label}>{r.name}</Text>
              <Text style={S.muted}>{r.pointsCost} points</Text>
            </View>
          </View>
          <Text style={S.muted}>{r.description}</Text>
          <Text style={S.small}>
            {r.availableStock > 0
              ? "Disponible à la réservation"
              : "Indisponible pour le moment"}
          </Text>
          {wallet && r.pointsCost > 0 ? (
            <View style={{ gap: 7 }}>
              <MeasuredProgress
                value={wallet.available / r.pointsCost}
                label={`${wallet.available} points disponibles sur ${r.pointsCost} nécessaires pour ${r.name}`}
              />
              <Text
                style={[
                  S.small,
                  {
                    color: wallet.available >= r.pointsCost ? C.green : C.muted,
                  },
                ]}
              >
                {wallet.available >= r.pointsCost
                  ? "Vous avez les points nécessaires."
                  : `Encore ${r.pointsCost - wallet.available} points pour ce cadeau.`}
              </Text>
            </View>
          ) : null}
          <Button
            loading={busy}
            disabled={
              session.user.shop?.canManage === false ||
              !wallet ||
              wallet.available < r.pointsCost ||
              wallet.correctionDue > 0 ||
              r.availableStock < 1
            }
            onPress={async () => {
              setBusy(true);
              setError("");
              try {
                keys.current[r.id] ??= operationKey();
                await post(`/rewards/${r.id}/reserve`, {
                  idempotencyKey: keys.current[r.id],
                });
                delete keys.current[r.id];
                await refresh();
                onNotice(
                  "Cadeau réservé. Vos points sont réservés jusqu’à la remise.",
                );
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Réserver ce cadeau
          </Button>
        </View>
      ))}
      {gifts.length ? (
        <>
          <Text style={E.title}>Mes demandes de cadeaux</Text>
          {gifts.map((g) => (
            <View key={g.id} style={E.thread}>
              <Icon name="gift-outline" color={C.green} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={S.label}>{g.rewardName}</Text>
                <Text style={S.small}>
                  {labels[g.status] || g.status} · {g.pointsCost} points ·{" "}
                  {date(g.createdAt)}
                </Text>
                {g.proofReference ? (
                  <Text style={S.small}>Preuve : {g.proofReference}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </>
      ) : null}
      <Button variant="ghost" onPress={() => setHistory(!history)}>
        {history ? "Masquer" : "Voir"} mon historique de points
      </Button>
      {history
        ? wallet?.entries?.map((e: any) => (
            <View key={e.id} style={E.thread}>
              <View style={{ flex: 1, gap: 5 }}>
                <Text style={S.label}>
                  {entryLabels[e.kind] || "Mouvement de points"}
                </Text>
                <Text style={S.small}>{date(e.at, true)}</Text>
              </View>
              <Text style={S.label}>
                {e.availableDelta > 0 ? "+" : ""}
                {e.availableDelta} pts
              </Text>
            </View>
          ))
        : null}
    </View>
  );
}
const E = StyleSheet.create({
  wrap: { gap: 20, paddingTop: 16, paddingBottom: 12 },
  title: {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    color: "#151917",
  },
  panel: { padding: 20, borderRadius: 16, backgroundColor: "#F4F6F4", gap: 14 },
  thread: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: "#E7EBE7",
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#D9EDDF",
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: {
    alignSelf: "flex-start",
    maxWidth: "92%",
    backgroundColor: "#F4F6F4",
    padding: 14,
    borderRadius: 12,
    gap: 7,
  },
});

const O = StyleSheet.create({
  wrap: { gap: 16, paddingTop: 12, paddingBottom: 12 },
  intro: { ...S.text, lineHeight: 19, color: C.muted },
  filter: {
    height: 44,
    borderRadius: 24,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  filterText: { ...S.text, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  brandTile: {
    width: 81.5,
    height: 54,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  brandName: { ...S.label, fontSize: 12, lineHeight: 16, flexShrink: 1 },
  brandPlate: {
    width: 96,
    minHeight: 34,
    padding: 6,
    backgroundColor: C.white,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  publisher: {
    ...S.small,
    color: C.ink,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "right",
    flex: 1,
  },
  campaign: { padding: 16, borderRadius: 16, gap: 12 },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    minHeight: 140,
  },
  benefit: { flex: 1, minWidth: 0, gap: 4 },
  offerValue: {
    ...S.heading,
    fontSize: 48,
    lineHeight: 65,
    fontWeight: "700",
    letterSpacing: -0.6,
  },
  goalValue: { fontSize: 24, lineHeight: 29 },
  condition: {
    ...S.subheading,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "700",
  },
  productName: { ...S.small, fontSize: 11, lineHeight: 15, color: C.ink },
  finePrint: { ...S.small, fontSize: 11, lineHeight: 15 },
  packshot: {
    width: 110,
    height: 140,
    borderRadius: 12,
    backgroundColor: C.white,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    ...S.subheading,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    marginTop: 0,
  },
});
