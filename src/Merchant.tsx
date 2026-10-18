import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { Image as FigmaImage } from "expo-image";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import {
  Address,
  api,
  API_ORIGIN,
  CartLine,
  CartQuote,
  date,
  money,
  operationKey,
  Order,
  OrderSummary,
  Page,
  post,
  Product,
  put,
  quantityLabel,
  remove,
  Session,
  statuses,
} from "./api";
import {
  Button,
  Empty,
  Field,
  FilterPill,
  Icon,
  Loading,
  Logo,
  Notice,
  ProductImage,
  Status,
  Stepper,
} from "./components";
import { C, S } from "./theme";
import { MerchantClaims } from "./Claims";
import { Campaigns, Conversations } from "./Engagement";
import MerchantAccount, {
  AccountPanel,
  accountTitles,
} from "./MerchantAccount";
import OrderGifts from "./OrderGifts";
import OrderAmendments from "./OrderAmendments";
import MerchantDelivery from "./MerchantDelivery";
import Recalls from "./Recalls";
import MerchantDiscovery, {
  categoryArtwork,
  type DiscoveryPanel,
} from "./MerchantDiscovery";
import { merchantTab } from "./runtime";
import { Tracking } from "./courier-api";
import { CartDockArrival, MeasuredProgress, StateArrival } from "./Motion";

type Props = {
  session: Session;
  onJoin: () => void;
  onSwitch: () => Promise<void>;
  onLogout: () => Promise<void>;
  onNotice: (message: string) => void;
};
type Screen =
  | "catalog"
  | "favorites"
  | "cart"
  | "orders"
  | "account"
  | "offers"
  | "messages";
const nav: { id: Screen; label: string; icon: string }[] = [
  { id: "catalog", label: "Accueil", icon: "home-outline" },
  { id: "offers", label: "Offres", icon: "pricetag-outline" },
  { id: "orders", label: "Commandes", icon: "cube-outline" },
  { id: "messages", label: "Messages", icon: "chatbubble-outline" },
  { id: "account", label: "Mon Toushir", icon: "person-outline" },
];
const categoryIcon = (name: string) =>
  /boisson|eau|jus/i.test(name)
    ? "water-outline"
    : /lait|fromage|laitier/i.test(name)
      ? "cafe-outline"
      : /biscuit|sucr|chocolat|snack/i.test(name)
        ? "ice-cream-outline"
        : /pâte|riz|semoule|céréal/i.test(name)
          ? "restaurant-outline"
          : /conserve|sauce|épicerie/i.test(name)
            ? "nutrition-outline"
            : "basket-outline";
const toLines = (quote: CartQuote): CartLine[] =>
  quote.items.map((item) => ({
    productId: item.product.id,
    quantity: item.quantity,
  }));
const cartSignature = (lines: CartLine[]) =>
  JSON.stringify(
    [...lines]
      .sort((a, b) => a.productId.localeCompare(b.productId))
      .map((line) => [line.productId, line.quantity]),
  );

export default function Merchant({
  session,
  onJoin,
  onSwitch,
  onLogout,
  onNotice,
}: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const wide = width >= 900;
  const canWrite = session.user.shop?.canOrder !== false;
  const canManageShop = session.user.shop?.canManage !== false;
  const columns = width >= 1080 ? 4 : width >= 680 ? 3 : 2;
  const [screen, setScreen] = useState<Screen>(() => {
    const target = Platform.OS === "web" ? window.location.hash.slice(1) : "";
    return [
      "catalog",
      "favorites",
      "cart",
      "orders",
      "account",
      "offers",
      "messages",
    ].includes(target)
      ? (target as Screen)
      : "catalog";
  });
  const [communicationSettings, setCommunicationSettings] = useState(false);
  const [messageContext, setMessageContext] = useState<
    { type: "ORDER"; id: string; subject: string } | undefined
  >();
  const [submittedOrder, setSubmittedOrder] = useState<string | null>(null);
  const [orderSynced, setOrderSynced] = useState<string | null>(null);
  const [orderConnected, setOrderConnected] = useState(true);
  const [accountPanel, setAccountPanel] = useState<AccountPanel>(null);
  const contentRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  useEffect(() => {
    contentRef.current?.scrollTo({ y: 0, animated: false });
  }, [accountPanel, screen]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<
    { id: string; name: string; count: number }[]
  >([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState(""),
    [inStock, setInStock] = useState(false),
    [discovery, setDiscovery] = useState<DiscoveryPanel | null>(null);
  const [sort, setSort] = useState("featured");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteProducts, setFavoriteProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [cartSaving, setCartSaving] = useState(false);
  const [cartSaveError, setCartSaveError] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [incomingOrder, setIncomingOrder] = useState<OrderSummary | null>(null);
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [orderPage, setOrderPage] = useState(1);
  const [orderPages, setOrderPages] = useState(1);
  const [order, setOrder] = useState<Order | null>(null);
  const [orderFilter, setOrderFilter] = useState("");
  const [orderView, setOrderView] = useState<"current" | "history">("current");
  const [orderFiltersOpen, setOrderFiltersOpen] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [addressForm, setAddressForm] = useState<{
    label: string;
    commune: string;
    street: string;
  } | null>(null);
  const checkoutKey = useRef(operationKey());
  const saveVersion = useRef(0);
  const saveQueue = useRef(Promise.resolve());
  const booted = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    let active = true;
    const initialCartVersion = saveVersion.current;
    Promise.all([
      api<CartQuote>("/cart"),
      api<Product[]>("/favorites"),
      api<Address[]>("/addresses"),
      api<any[]>("/categories"),
    ])
      .then(([basket, favorites, locations, cats]) => {
        if (!active) return;
        if (initialCartVersion === saveVersion.current) {
          setCart(toLines(basket));
          setQuote(basket);
        }
        setFavoriteProducts(favorites);
        setAddresses(locations);
        setAddressId(locations[0]?.id || "");
        setCategories(cats);
        booted.current = true;
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [session.user.id]);
  useEffect(() => {
    let active = true;
    const load = () =>
      api<Page<OrderSummary>>("/orders?page=1&pageSize=15")
        .then((r) => {
          if (active)
            setIncomingOrder(
              r.items.find((o) =>
                [
                  "SUBMITTED",
                  "CONFIRMED",
                  "PREPARING",
                  "READY",
                  "OUT_FOR_DELIVERY",
                ].includes(o.status),
              ) || null,
            );
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session.user.id, refresh]);
  useEffect(() => {
    if (screen !== "catalog") return;
    let active = true;
    setLoading(true);
    setError("");
    api<Page<Product>>(
      `/products?page=${page}&pageSize=30&q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&brand=${encodeURIComponent(brand)}&inStock=${inStock}&sort=${sort}`,
    )
      .then((result) => {
        if (active) {
          setProducts(result.items);
          setTotal(result.total);
          setTotalPages(result.totalPages);
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [screen, query, category, brand, inStock, page, sort, refresh]);
  useEffect(() => {
    if (screen !== "orders") return;
    let active = true;
    const load = async () => {
      try {
        const result = await api<Page<OrderSummary>>(
          `/orders?page=${orderPage}&pageSize=15&status=${orderFilter}`,
        );
        if (active) {
          setOrders(result.items);
          setOrderPages(result.totalPages);
          setLoading(false);
        }
      } catch (e: any) {
        if (active) {
          setError(e.message);
          setLoading(false);
        }
      }
    };
    setLoading(true);
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [screen, orderPage, orderFilter, refresh]);
  useEffect(() => {
    if (!order) return;
    setOrderSynced(null);
    setOrderConnected(true);
    let active = true;
    const timer = setInterval(
      () =>
        api<Order>(`/orders/${order.id}`)
          .then((value) => {
            if (active) {
              setOrder(value);
              setOrderSynced(new Date().toISOString());
              setOrderConnected(true);
            }
          })
          .catch(() => {
            if (active) setOrderConnected(false);
          }),
      15000,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [order?.id]);
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      if (discovery) {
        setDiscovery(null);
        return true;
      }
      if (selectedProduct) {
        setSelectedProduct(null);
        return true;
      }
      if (order) {
        setOrder(null);
        return true;
      }
      if (accountPanel) {
        setAccountPanel(null);
        return true;
      }
      if (screen !== "catalog") {
        setScreen("catalog");
        return true;
      }
      return false;
    });
    return () => listener.remove();
  }, [screen, selectedProduct, order, accountPanel, discovery]);
  const navigate = (target: Screen) => {
    setAccountPanel(null);
    setScreen(target);
    setError("");
    setOrder(null);
    setSelectedProduct(null);
    if (target !== "messages") setMessageContext(undefined);
    merchantTab(target);
  };
  const favoriteIds = new Set(favoriteProducts.map((p) => p.id));
  const cartCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const cartQuantity = (p: Product) =>
    cart.find((line) => line.productId === p.id)?.quantity || 0;
  const saveCart = (next: CartLine[]) => {
    if (busy) return;
    const actorId = session.user.id;
    setCart(next);
    setCartSaving(true);
    setCartSaveError(false);
    checkoutKey.current = operationKey();
    const version = ++saveVersion.current;
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        try {
          const result = await put<CartQuote>(
            "/cart",
            { items: next },
            { headers: { "X-Toushir-Actor": actorId } },
          );
          if (version === saveVersion.current) {
            setQuote(result);
            setCartSaveError(false);
          }
        } catch (e: any) {
          if (version === saveVersion.current) {
            setError(e.message);
            setCartSaveError(true);
          }
        } finally {
          if (version === saveVersion.current) setCartSaving(false);
        }
      });
  };
  function changeQuantity(product: Product, quantity: number) {
    if (busy) return;
    setError("");
    const next = cart.filter((line) => line.productId !== product.id);
    if (quantity > 0) next.push({ productId: product.id, quantity });
    saveCart(next);
  }
  async function toggleFavorite(product: Product) {
    try {
      if (favoriteIds.has(product.id)) {
        await remove(`/favorites/${product.id}`);
        setFavoriteProducts((old) => old.filter((p) => p.id !== product.id));
      } else {
        await post(`/favorites/${product.id}`);
        setFavoriteProducts((old) => [...old, product]);
      }
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function checkout() {
    if (busy || cartSaving) return;
    if (!canWrite) {
      setError(
        "Votre accès est en lecture seule. Une personne habilitée doit confirmer la commande.",
      );
      return;
    }
    if (!addressId) {
      setError(
        "Ajoutez une adresse de livraison avant d’envoyer votre demande.",
      );
      return;
    }
    const displayed = quote;
    if (
      cartSaveError ||
      !displayed ||
      cartSignature(toLines(displayed)) !== cartSignature(cart)
    ) {
      setError(
        "Votre panier doit être enregistré et son récapitulatif actualisé avant de continuer.",
      );
      return;
    }
    if (
      !displayed.needsQuote &&
      (!displayed.canOrder || !displayed.pricingToken)
    ) {
      setError(
        "Actualisez votre panier pour vérifier le prix avant de confirmer.",
      );
      return;
    }
    const submitted = cart.map((line) => ({ ...line }));
    const headers = { "X-Toushir-Actor": session.user.id };
    setBusy(true);
    setError("");
    try {
      await saveQueue.current;
      const result = await post<Order>(
        "/orders",
        {
          idempotencyKey: checkoutKey.current,
          addressId,
          items: submitted,
          note,
          mode: displayed.needsQuote ? "REQUEST_QUOTE" : "PLACE_ORDER",
          pricingToken: displayed.pricingToken || null,
        },
        { headers },
      );
      ++saveVersion.current;
      setCart([]);
      setQuote(null);
      setCartSaving(false);
      setNote("");
      checkoutKey.current = operationKey();
      navigate("orders");
      setSubmittedOrder(result.id);
      setOrderConnected(true);
      setOrderSynced(new Date().toISOString());
      setOrder(result);
      setRefresh((n) => n + 1);
      onNotice(
        displayed.needsQuote
          ? "Votre demande de prix a bien été transmise."
          : result.status === "SUBMITTED"
            ? "Commande reçue. La confirmation de votre grossiste est attendue."
            : "Commande confirmée. Suivez sa préparation dans l’application.",
      );
    } catch (e: any) {
      if (
        [
          "PRICE_CONFIRMATION_REQUIRED",
          "QUOTE_REQUIRED",
          "STOCK_CONFLICT",
          "GIFT_STOCK_CONFLICT",
        ].includes(e.code)
      ) {
        try {
          const updated = await put<CartQuote>(
            "/cart",
            { items: submitted },
            { headers },
          );
          setQuote(updated);
          setError(
            "Récapitulatif actualisé. Vérifiez les montants et les conditions, puis confirmez à nouveau.",
          );
        } catch (refreshError: any) {
          setError(refreshError.message);
          setCartSaveError(true);
        }
      } else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function orderAction(
    action: string,
    body: any = {},
    message = "Votre commande a été mise à jour.",
  ) {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const result = await post<any>(`/orders/${order.id}/${action}`, body);
      if (action === "reorder") {
        saveCart(toLines(result));
        setOrder(null);
        navigate("cart");
      } else {
        setOrder(result);
        setRefresh((n) => n + 1);
      }
      onNotice(message);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveAddress() {
    if (!addressForm || !canManageShop) return;
    setBusy(true);
    setError("");
    try {
      const next = await post<Address>("/addresses", {
        ...addressForm,
        wilaya: "Oran",
      });
      setAddresses((old) => [...old, next]);
      setAddressId(next.id);
      setAddressForm(null);
      onNotice("Adresse de livraison ajoutée.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function confirmCancel() {
    const run = () =>
      orderAction(
        "cancel",
        { reason: "Annulation demandée par le commerçant." },
        "Votre demande a été annulée.",
      );
    if (Platform.OS === "web") {
      if (
        window.confirm(
          "Annuler cette demande ? Les quantités réservées seront libérées.",
        )
      )
        run();
    } else
      Alert.alert(
        "Annuler cette demande ?",
        "Les quantités réservées seront libérées.",
        [
          { text: "Conserver", style: "cancel" },
          { text: "Annuler la demande", style: "destructive", onPress: run },
        ],
      );
  }
  const appWidth = Math.min(width, 520) - (Platform.OS === "web" ? 2 : 0);
  const cardWidth = (appWidth - 52) / 2;
  const catalogRef = useRef<FlatList<Product>>(null);
  useEffect(() => {
    catalogRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [page, query, category]);
  const selectedAddress =
    addresses.find((a) => a.id === addressId) || addresses[0];
  const handleSwitch = () => onSwitch().catch((e) => setError(e.message));
  const handleLogout = () => onLogout().catch((e) => setError(e.message));
  const productCard = (product: Product) => (
    <View style={[M.productCard, { width: cardWidth }]}>
      <View style={M.packshot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir ${product.name}`}
          onPress={() => setSelectedProduct(product)}
        >
          <ProductImage
            uri={product.imageUrl}
            name={product.name}
            style={{
              height: appWidth < 370 ? 112 : 120,
              aspectRatio: undefined,
            }}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${favoriteIds.has(product.id) ? "Retirer" : "Ajouter"} ${product.name} ${favoriteIds.has(product.id) ? "des" : "aux"} favoris`}
          onPress={() => toggleFavorite(product)}
          style={({ pressed }) => [M.favorite, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Icon
            name={favoriteIds.has(product.id) ? "heart" : "heart-outline"}
            size={20}
            color={favoriteIds.has(product.id) ? C.green : C.ink}
          />
        </Pressable>
      </View>
      <View style={M.productBody}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSelectedProduct(product)}
        >
          <Text style={M.productName} numberOfLines={2}>
            {product.name}
          </Text>
        </Pressable>
        <Text style={M.pack} numberOfLines={1}>
          {quantityLabel(product)}
        </Text>
        <View
          style={[
            S.between,
            {
              gap: 6,
              alignItems: "center",
              marginTop: "auto",
              flexWrap: "wrap",
            },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[M.price, { marginTop: 0, marginBottom: 0 }]}>
              {money(product.price)}
            </Text>
            <Text style={[S.small, { fontSize: 10, lineHeight: 14 }]}>
              {product.unit || "unité à confirmer"}
            </Text>
          </View>
          {cartQuantity(product) ? (
            <QuantityControl
              disabled={busy}
              value={cartQuantity(product)}
              minimum={product.minimumQuantity || 1}
              onChange={(n) => changeQuantity(product, n)}
              name={product.name}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Ajouter ${product.name} au panier`}
              hitSlop={5}
              accessibilityState={{ disabled: busy }}
              disabled={busy}
              onPress={() => {
                changeQuantity(product, product.minimumQuantity || 1);
                onNotice("Ajouté au panier");
              }}
              style={({ pressed }) => [
                M.addButton,
                { opacity: busy ? 0.45 : pressed ? 0.7 : 1 },
              ]}
            >
              <View style={M.addButtonFace}>
                <FigmaImage
                  source={require("../assets/figma/mobile-merchant-home-c547b.svg")}
                  style={{ width: 22, height: 22 }}
                />
              </View>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
  const categoryStrip = (
    <>
      <View style={[S.between, { marginTop: 12, marginBottom: 8 }]}>
        <Text style={[M.sectionTitle, { fontSize: 22, lineHeight: 30 }]}>
          Vos rayons
        </Text>
        <Button
          variant="ghost"
          small
          onPress={() => setDiscovery("categories")}
        >
          Tout voir
        </Button>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={M.categoryRail}
      >
        {[...categories]
          .sort((a, b) => {
            const rank = (n: string) =>
              /boisson/i.test(n)
                ? 0
                : /biscuit/i.test(n)
                  ? 1
                  : /lait|frais/i.test(n)
                    ? 2
                    : /épicerie/i.test(n)
                      ? 3
                      : 4;
            return rank(a.name) - rank(b.name);
          })
          .slice(0, 8)
          .map((cat, index) => (
            <CategoryShortcut
              key={cat.id}
              label={cat.name}
              icon={categoryIcon(cat.name)}
              active={category === cat.id}
              onPress={() => {
                setCategory(category === cat.id ? "" : cat.id);
                setPage(1);
              }}
            />
          ))}
      </ScrollView>
    </>
  );
  const title =
    screen === "favorites"
      ? "Mes favoris"
      : screen === "cart"
        ? "Mon panier"
        : screen === "orders"
          ? "Mes commandes"
          : screen === "account"
            ? "Mon Toushir"
            : screen === "offers"
              ? "Offres"
              : screen === "messages"
                ? "Messages"
                : "Catalogue";
  const catalogTools = (
    <View style={{ gap: 16, paddingTop: 12, paddingBottom: 16 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choisir l’adresse de livraison"
        onPress={() => setLocationOpen(true)}
        hitSlop={{ top: 12, bottom: 12 }}
        style={[S.row, { minHeight: 19, gap: 8 }]}
      >
        <FigmaImage
          source={require("../assets/figma/mobile-merchant-home-237ad.svg")}
          style={{ width: 18, height: 18 }}
        />
        <Text style={[S.label, { flex: 1 }]} numberOfLines={1}>
          {selectedAddress?.label || session.user.shopName || "Mon commerce"} ·{" "}
          {selectedAddress?.commune || "Oran"}
        </Text>
        <FigmaImage
          source={require("../assets/figma/mobile-merchant-home-6fe86.svg")}
          style={{ width: 16, height: 16 }}
        />
      </Pressable>

      <View style={[S.row, { gap: 10 }]}>
        <View style={[M.search, { flex: 1, marginTop: 0 }]}>
          <FigmaImage
            source={require("../assets/figma/mobile-merchant-home-16ce4.svg")}
            style={{ width: 22, height: 22 }}
          />
          <TextInput
            accessibilityLabel="Rechercher un produit, une marque ou un code-barres"
            placeholder="Produit, marque, code-barres"
            placeholderTextColor={C.muted}
            value={search}
            onChangeText={(v) => {
              setSearch(v);
              if (screen === "favorites") navigate("catalog");
            }}
            style={M.searchInput}
            returnKeyType="search"
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              onPress={() => setSearch("")}
              style={M.iconButton}
            >
              <Icon name="close-circle" color={C.muted} size={20} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Rechercher un produit par code-barres"
          onPress={() => setDiscovery("scanner")}
          style={[M.headerAction, { backgroundColor: C.ink }]}
        >
          <FigmaImage
            source={require("../assets/figma/mobile-merchant-home-59ff6.svg")}
            style={{ width: 22, height: 22 }}
          />
        </Pressable>
      </View>
    </View>
  );
  const header = ["offers", "messages", "orders", "account"].includes(
    screen,
  ) ? (
    <View style={[M.header, { minHeight: 64, paddingBottom: 0 }]}>
      <View style={[S.between, { minHeight: 64 }]}>
        {screen === "account" && accountPanel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour à Mon Toushir"
            onPress={() => setAccountPanel(null)}
            style={M.headerAction}
          >
            <Icon name="arrow-back" size={22} />
          </Pressable>
        ) : null}
        <Text
          style={[
            M.screenTitle,
            {
              fontSize: screen === "account" && accountPanel ? 22 : 28,
              lineHeight: 32,
              flex: 1,
            },
          ]}
        >
          {screen === "account" && accountPanel
            ? accountTitles[accountPanel]
            : title}
        </Text>
        {screen === "offers" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes favoris"
            style={M.headerAction}
            onPress={() => navigate("favorites")}
          >
            <FigmaImage
              source={require("../assets/figma/mobile-merchant-home-71cce.svg")}
              style={{ width: 22, height: 22 }}
            />
          </Pressable>
        ) : screen === "account" && !accountPanel ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paramètres du compte"
            style={M.headerAction}
            onPress={() => setAccountPanel("settings")}
          >
            <FigmaImage
              source={require("../assets/figma/mobile-merchant-account-60888.svg")}
              style={{ width: 22, height: 22 }}
            />
          </Pressable>
        ) : screen === "messages" && canManageShop ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Préférences de communication"
            onPress={() => setCommunicationSettings((n) => !n)}
            style={M.headerAction}
          >
            <FigmaImage
              source={require("../assets/figma/mobile-merchant-account-60888.svg")}
              style={{ width: 22, height: 22 }}
            />
          </Pressable>
        ) : screen === "orders" ? (
          <Button
            variant="ghost"
            icon="refresh-outline"
            label="Actualiser les commandes"
            onPress={() => setRefresh((n) => n + 1)}
          />
        ) : null}
      </View>
    </View>
  ) : (
    <View style={M.header}>
      <View style={[S.between, { minHeight: 64 }]}>
        <FigmaImage
          source={require("../assets/figma/mobile-merchant-home-ef546.svg")}
          style={{ width: 112, height: 29 }}
          contentFit="contain"
          accessibilityLabel="Toushir"
        />
        <View style={S.row}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes favoris"
            onPress={() => navigate("favorites")}
            style={M.headerAction}
          >
            <FigmaImage
              source={require("../assets/figma/mobile-merchant-home-71cce.svg")}
              style={{ width: 22, height: 22 }}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mes commandes et notifications"
            onPress={() => navigate("orders")}
            style={M.headerAction}
          >
            <FigmaImage
              source={require("../assets/figma/mobile-merchant-home-2e62d.svg")}
              style={{ width: 22, height: 22 }}
            />
          </Pressable>
        </View>
      </View>
      {screen === "favorites" ? catalogTools : null}
      {screen === "catalog" || screen === "favorites" ? null : (
        <View style={[S.between, { paddingTop: 14, paddingBottom: 3 }]}>
          <Text style={M.screenTitle}>{title}</Text>
          {screen === "orders" ? (
            <Button
              variant="ghost"
              icon="refresh-outline"
              label="Actualiser les commandes"
              onPress={() => setRefresh((n) => n + 1)}
            />
          ) : screen === "cart" ? (
            <Text style={S.small}>
              {cart.length} références · {cartCount} unités
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );
  const demoStrip = session.workspace.isDemo ? (
    <View style={M.demoStrip}>
      <View style={S.row}>
        <Icon name="flask-outline" size={12} color={C.muted} />
        <Text style={M.demoText}>Démo · prix et stocks fictifs</Text>
      </View>
      {session.workspace.canSwitchRole ? (
        <Pressable
          accessibilityRole="button"
          onPress={handleSwitch}
          style={{
            paddingVertical: 8,
            paddingLeft: 12,
            flexDirection: "row",
            gap: 4,
            alignItems: "center",
          }}
        >
          <Text style={[M.demoText, { fontWeight: "700", color: C.ink }]}>
            Espace grossiste
          </Text>
          <Icon name="arrow-up-right-box-outline" size={12} color={C.ink} />
        </Pressable>
      ) : null}
    </View>
  ) : null;
  const sectionHeader = (
    text: string,
    detail?: string,
    action?: React.ReactNode,
  ) => (
    <View
      style={[
        S.between,
        { marginTop: 12, marginBottom: 8, alignItems: "flex-start" },
      ]}
    >
      <View style={{ flex: 1, gap: 5 }}>
        <Text style={M.sectionTitle}>{text}</Text>
        {detail ? <Text style={S.muted}>{detail}</Text> : null}
      </View>
      {action}
    </View>
  );
  const checkoutFooter =
    screen === "cart" && cart.length > 0 && quote ? (
      <View style={M.checkoutFooter}>
        <View style={[S.between, { paddingBottom: 12 }]}>
          <Text style={S.label}>
            {quote.needsQuote ? "Montant après devis" : "Total de la commande"}
          </Text>
          <Text style={[S.subheading, { fontSize: 17 }]}>
            {quote.needsQuote ? "À confirmer" : money(quote.total)}
          </Text>
        </View>
        <Button
          icon="arrow-forward"
          loading={busy || cartSaving}
          disabled={
            !canWrite ||
            !addressId ||
            cartSaveError ||
            cartSignature(toLines(quote)) !== cartSignature(cart) ||
            session.user.approvalStatus === "PENDING"
          }
          onPress={checkout}
        >
          {!canWrite
            ? "Accès en lecture seule"
            : quote.needsQuote
              ? "Demander mon devis"
              : "Confirmer la commande"}
        </Button>
        {cartSaveError ? (
          <Button variant="ghost" onPress={() => saveCart([...cart])}>
            Réessayer l’enregistrement du panier
          </Button>
        ) : null}
        <Text style={[S.small, { textAlign: "center", marginTop: 8 }]}>
          {quote.needsQuote
            ? "Le grossiste vous proposera un prix à valider."
            : "Prix vérifié · préparation et livraison suivies dans l’application."}
        </Text>
      </View>
    ) : null;

  if (discovery)
    return (
      <View style={M.app}>
        <MerchantDiscovery
          panel={discovery}
          categories={categories}
          query={query}
          filters={{ category, brand, sort, inStock }}
          onClose={() => setDiscovery(null)}
          onApply={(filters) => {
            setCategory(filters.category);
            setBrand(filters.brand);
            setSort(filters.sort);
            setInStock(filters.inStock);
            setPage(1);
            setDiscovery(null);
            navigate("catalog");
          }}
          onProduct={(product) => {
            setDiscovery(null);
            setSelectedProduct(product);
          }}
        />
      </View>
    );
  return (
    <View style={M.app}>
      {header}
      {demoStrip}
      {error ? (
        <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
          <Notice error>{error}</Notice>
          <Button
            small
            variant="ghost"
            icon="refresh-outline"
            onPress={() => {
              if (cartSaveError || screen === "cart") saveCart([...cart]);
              else setRefresh((n) => n + 1);
            }}
          >
            {screen === "cart" ? "Actualiser le panier" : "Réessayer"}
          </Button>
        </View>
      ) : null}
      {screen === "catalog" ? (
        <FlatList
          ref={catalogRef}
          key="merchant-two-columns"
          data={loading ? [] : products}
          numColumns={2}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => productCard(item)}
          columnWrapperStyle={{ gap: 12, marginBottom: 12 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => setRefresh((n) => n + 1)}
              tintColor={C.green}
            />
          }
          ListHeaderComponent={
            <>
              {catalogTools}
              <Recalls revision={refresh} canAcknowledge={canWrite} />
              {!query && !category && page === 1 && incomingOrder ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Suivre ma livraison"
                  onPress={() =>
                    api<Order>(`/orders/${incomingOrder.id}`)
                      .then(setOrder)
                      .catch((e) => setError(e.message))
                  }
                  style={[
                    M.valueStrip,
                    { backgroundColor: C.blueBg, padding: 14 },
                  ]}
                >
                  <FigmaImage
                    source={require("../assets/figma/astra-home-truck.svg")}
                    style={{ width: 24, height: 24 }}
                  />
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={M.valueTitle}>
                      {incomingOrder.status === "OUT_FOR_DELIVERY"
                        ? "Votre commande arrive"
                        : incomingOrder.status === "READY"
                          ? "Votre commande est prête"
                          : incomingOrder.status === "PREPARING"
                            ? "Votre commande se prépare"
                            : incomingOrder.status === "SUBMITTED"
                              ? "Votre commande est reçue"
                              : "Votre commande est confirmée"}
                    </Text>
                    <Text style={[M.valueText, { color: C.blue }]}>
                      {incomingOrder.number} · consulter le suivi
                    </Text>
                  </View>
                </Pressable>
              ) : null}
              {categoryStrip}
              <View style={[S.between, { paddingBottom: 16, paddingTop: 8 }]}>
                <Text style={[M.sectionTitle, { flex: 1 }]}>
                  {query
                    ? `« ${query} »`
                    : category
                      ? categories.find((c) => c.id === category)?.name ||
                        category
                      : brand || "Pour votre réassort"}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Filtrer et trier les produits"
                  onPress={() => setDiscovery("filters")}
                  hitSlop={10}
                  style={{ minHeight: 30, justifyContent: "center" }}
                >
                  <Text style={[S.label, { color: C.green, fontSize: 12 }]}>
                    Filtres
                  </Text>
                </Pressable>
              </View>
              {query || category || brand || inStock ? (
                <View style={[S.between, { marginBottom: 12 }]}>
                  <Text style={S.small}>
                    {total.toLocaleString("fr-DZ")} produits
                  </Text>
                  <Button
                    small
                    variant="ghost"
                    onPress={() => {
                      setSearch("");
                      setCategory("");
                      setBrand("");
                      setInStock(false);
                      setPage(1);
                    }}
                  >
                    Effacer les filtres
                  </Button>
                </View>
              ) : null}
              {loading ? <Loading count={2} /> : null}
            </>
          }
          ListEmptyComponent={
            !loading ? (
              <Empty
                title="Aucun produit trouvé"
                message="Essayez un autre nom, une marque ou une catégorie."
                icon="search-outline"
                action={
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setSearch("");
                      setCategory("");
                      setBrand("");
                      setInStock(false);
                    }}
                  >
                    Tout le catalogue
                  </Button>
                }
              />
            ) : undefined
          }
          ListFooterComponent={
            <>
              <View style={[S.between, { marginTop: 16, marginBottom: 8 }]}>
                <Text style={M.sectionTitle}>Vos marques</Text>
                <Button
                  variant="ghost"
                  small
                  onPress={() => setDiscovery("brands")}
                >
                  Tout voir
                </Button>
              </View>
              {totalPages > 1 ? (
                <View
                  style={[
                    S.row,
                    { justifyContent: "space-between", marginTop: 14 },
                  ]}
                >
                  <Button
                    variant="secondary"
                    icon="chevron-back"
                    disabled={page <= 1}
                    onPress={() => setPage((p) => p - 1)}
                    label="Page précédente"
                  />
                  <Text style={S.small}>
                    Page {page} sur {totalPages}
                  </Text>
                  <Button
                    variant="secondary"
                    icon="chevron-forward"
                    disabled={page >= totalPages}
                    onPress={() => setPage((p) => p + 1)}
                    label="Page suivante"
                  />
                </View>
              ) : undefined}
            </>
          }
        />
      ) : (
        <ScrollView
          ref={contentRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
        >
          {screen === "offers" ? (
            <Campaigns
              session={session}
              onNotice={onNotice}
              onProduct={(id) =>
                api<Product>(`/products/${id}`)
                  .then(setSelectedProduct)
                  .catch((e) => setError(e.message))
              }
            />
          ) : null}
          {screen === "messages" ? (
            <>
              <Recalls revision={refresh} canAcknowledge={canWrite} />
              <Conversations
                session={session}
                initialContext={messageContext}
                settingsOpen={communicationSettings}
              />
            </>
          ) : null}
          {screen === "favorites" ? (
            <>
              {sectionHeader(
                "Les essentiels de votre commerce",
                "Retrouvez vos produits pour le prochain réassort.",
              )}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {favoriteProducts.map((p) => (
                  <React.Fragment key={p.id}>{productCard(p)}</React.Fragment>
                ))}
              </View>
              {!favoriteProducts.length ? (
                <Empty
                  title="Gardez vos essentiels"
                  message="Touchez le cœur sur un produit pour le retrouver ici."
                  icon="heart-outline"
                  action={
                    <Button onPress={() => navigate("catalog")}>
                      Explorer le catalogue
                    </Button>
                  }
                />
              ) : null}
            </>
          ) : null}
          {screen === "cart" ? (
            <>
              {cart.length && quote ? (
                <View style={{ gap: 16, paddingTop: 16 }}>
                  <View style={M.group}>
                    {quote.items
                      .filter((item) =>
                        cart.some((line) => line.productId === item.product.id),
                      )
                      .map((item, i, values) => (
                        <View
                          key={item.product.id}
                          style={[
                            M.cartRow,
                            {
                              borderBottomWidth: i < values.length - 1 ? 1 : 0,
                            },
                          ]}
                        >
                          <ProductImage
                            uri={item.product.imageUrl}
                            name={item.product.name}
                            size={70}
                          />
                          <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
                            <Text style={M.brand}>{item.product.brand}</Text>
                            <Text
                              style={[
                                S.text,
                                { fontWeight: "600", lineHeight: 19 },
                              ]}
                              numberOfLines={2}
                            >
                              {item.product.name}
                            </Text>
                            <Text style={S.small}>
                              {quantityLabel(item.product)}
                            </Text>
                            {item.promotion ? (
                              <Text style={[S.small, { color: C.green }]}>
                                {item.promotion.issue ||
                                item.issues.includes("CADEAU_A_CONFIRMER")
                                  ? "Avantage à confirmer dans votre devis"
                                  : item.promotion.kind === "FREE_GOODS"
                                    ? `${item.promotion.giftQuantity} unité(s) de ${item.promotion.giftProductName} offerte(s)`
                                    : `${item.promotion.campaignTitle} · remise comprise dans le prix`}
                              </Text>
                            ) : null}
                            <View
                              style={[
                                S.between,
                                { flexWrap: "wrap", marginTop: 5 },
                              ]}
                            >
                              <Text style={S.label}>
                                {money(item.unitPrice)}
                              </Text>
                              <QuantityControl
                                disabled={busy}
                                compact
                                value={
                                  cart.find(
                                    (l) => l.productId === item.product.id,
                                  )?.quantity || 0
                                }
                                minimum={item.product.minimumQuantity || 1}
                                onChange={(n) =>
                                  changeQuantity(item.product, n)
                                }
                                name={item.product.name}
                              />
                            </View>
                          </View>
                        </View>
                      ))}
                  </View>
                  <Button
                    variant="secondary"
                    icon="add"
                    onPress={() => navigate("catalog")}
                  >
                    Ajouter des produits
                  </Button>
                  <View style={M.group}>
                    <View style={[S.between, { marginBottom: 12 }]}>
                      <Text style={M.sectionTitle}>Adresse de livraison</Text>
                      <Button
                        variant="ghost"
                        small
                        onPress={() => setLocationOpen(true)}
                      >
                        Modifier
                      </Button>
                    </View>
                    {selectedAddress ? (
                      <View style={S.row}>
                        <Icon name="location-outline" color={C.green} />
                        <View style={{ flex: 1 }}>
                          <Text style={S.label}>{selectedAddress.label}</Text>
                          <Text style={S.muted}>{selectedAddress.street}</Text>
                          <Text style={S.small}>
                            {selectedAddress.commune}, {selectedAddress.wilaya}
                          </Text>
                        </View>
                      </View>
                    ) : (
                      <Button
                        variant="secondary"
                        icon="add"
                        onPress={() =>
                          setAddressForm({
                            label: "Mon commerce",
                            commune: "Oran",
                            street: "",
                          })
                        }
                      >
                        Ajouter une adresse
                      </Button>
                    )}
                  </View>
                  <View style={M.group}>
                    <Text style={[M.sectionTitle, { marginBottom: 14 }]}>
                      Votre récapitulatif
                    </Text>
                    <Info label="Produits" value={money(quote.subtotal)} />
                    <View style={{ height: 12 }} />
                    <Info
                      label="Livraison"
                      value={
                        quote.needsQuote || quote.deliveryFee == null
                          ? "À confirmer"
                          : money(quote.deliveryFee)
                      }
                    />
                    {quote.needsQuote ? (
                      <Text style={[S.small, { marginTop: 14 }]}>
                        Le grossiste vous propose un prix et des quantités
                        disponibles. Rien n’est réservé avant votre acceptation.
                      </Text>
                    ) : null}
                  </View>
                  <View style={M.group}>
                    <Field
                      label="Une précision pour le grossiste ?"
                      editable={!busy}
                      value={note}
                      onChangeText={setNote}
                      placeholder="Accès au commerce, préférence de livraison…"
                      multiline
                    />
                  </View>
                </View>
              ) : (
                <Empty
                  title="Votre panier est vide"
                  message="Choisissez les produits dont votre commerce a besoin. Votre grossiste confirmera son offre."
                  icon="bag-handle-outline"
                  action={
                    <Button onPress={() => navigate("catalog")}>
                      Voir les produits
                    </Button>
                  }
                />
              )}
            </>
          ) : null}
          {screen === "orders" ? (
            <>
              <View style={[S.between, { paddingTop: 12, paddingBottom: 20 }]}>
                <View style={[S.row, { gap: 8 }]}>
                  {(
                    [
                      ["current", "En cours"],
                      ["history", "Historique"],
                    ] as const
                  ).map(([id, label]) => (
                    <Pressable
                      key={id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: orderView === id }}
                      onPress={() => {
                        setOrderView(id);
                        setOrderFilter("");
                        setOrderPage(1);
                      }}
                      style={[
                        M.orderFilterPill,
                        { backgroundColor: orderView === id ? C.ink : C.bg },
                      ]}
                    >
                      <Text
                        style={[
                          M.orderFilterText,
                          { color: orderView === id ? C.white : C.ink },
                        ]}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Button
                  variant="ghost"
                  icon="options-outline"
                  label="Filtrer par état de commande"
                  onPress={() => setOrderFiltersOpen((value) => !value)}
                  style={{ width: 44, minHeight: 44, paddingHorizontal: 0 }}
                />
              </View>
              {orderFiltersOpen ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 17 }}
                >
                  {[
                    ["", "Toutes"],
                    ["REQUESTED", "Demandes"],
                    ["QUOTED", "Offres à valider"],
                    ["CONFIRMED", "Confirmées"],
                    ["PREPARING", "En préparation"],
                    ["READY", "Prêtes"],
                    ["OUT_FOR_DELIVERY", "En livraison"],
                    ["DELIVERED", "Livrées"],
                    ["PARTIALLY_DELIVERED", "Livraisons partielles"],
                    ["CANCELLED", "Annulées"],
                  ].map(([value, label]) => (
                    <CategoryPill
                      key={value}
                      label={label}
                      active={orderFilter === value}
                      onPress={() => {
                        setOrderFilter(value);
                        setOrderPage(1);
                      }}
                    />
                  ))}
                </ScrollView>
              ) : null}
              {orderView === "current" && !orderFilter && incomingOrder ? (
                <OrderDeliveryPreview
                  summary={incomingOrder}
                  isDemo={session.workspace.isDemo}
                  onOpen={() =>
                    api<Order>(`/orders/${incomingOrder.id}`)
                      .then(setOrder)
                      .catch((e) => setError(e.message))
                  }
                />
              ) : null}
              <View style={[S.between, { marginTop: 20, marginBottom: 8 }]}>
                <Text style={M.sectionTitle}>
                  {orderView === "history"
                    ? "Historique des commandes"
                    : "Dernières commandes"}
                </Text>
              </View>
              {loading ? (
                <Loading count={2} />
              ) : orders.length ? (
                <View style={{ gap: 12 }}>
                  {orders.map((o) => (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Ouvrir ${o.number}`}
                      key={o.id}
                      onPress={() =>
                        api<Order>(`/orders/${o.id}`)
                          .then(setOrder)
                          .catch((e) => setError(e.message))
                      }
                      style={({ pressed }) => [
                        M.recentOrder,
                        { opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <FigmaImage
                        source={
                          o.status === "DELIVERED"
                            ? require("../assets/figma/astra-order-check.svg")
                            : require("../assets/figma/mobile-merchant-home-83fb6.svg")
                        }
                        style={{ width: 24, height: 24 }}
                      />
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          style={[S.label, { fontSize: 15, lineHeight: 21 }]}
                        >
                          {o.number} · {statuses[o.status] || o.status}
                        </Text>
                        <Text style={S.small}>
                          {date(o.createdAt)} · {money(o.total)}
                        </Text>
                        {o.status === "QUOTED" ? (
                          <Text style={[S.small, { color: C.reward }]}>
                            Votre offre est prête à valider
                          </Text>
                        ) : null}
                      </View>
                      <FigmaImage
                        source={require("../assets/figma/astra-order-chevron.svg")}
                        style={{ width: 20, height: 20 }}
                      />
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Empty
                  title="Vos commandes, au même endroit"
                  message="Après votre première commande, retrouvez ici la confirmation, la préparation, la livraison et le règlement."
                  icon="receipt-outline"
                  action={
                    <Button onPress={() => navigate("catalog")}>
                      Commencer une commande
                    </Button>
                  }
                />
              )}
              {orderPages > 1 ? (
                <View style={[S.between, { marginTop: 20 }]}>
                  <Button
                    variant="secondary"
                    icon="chevron-back"
                    label="Commandes précédentes"
                    disabled={orderPage === 1}
                    onPress={() => setOrderPage((p) => p - 1)}
                  />
                  <Text style={S.small}>
                    {orderPage} / {orderPages}
                  </Text>
                  <Button
                    variant="secondary"
                    icon="chevron-forward"
                    label="Commandes suivantes"
                    disabled={orderPage === orderPages}
                    onPress={() => setOrderPage((p) => p + 1)}
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {screen === "account" ? (
            <MerchantAccount
              session={session}
              panel={accountPanel}
              onPanel={setAccountPanel}
              addresses={addresses}
              onAddAddress={() =>
                setAddressForm({
                  label: "Mon commerce",
                  commune: "Oran",
                  street: "",
                })
              }
              onOrders={() => navigate("orders")}
              onOrder={(id) =>
                api<Order>(`/orders/${id}`)
                  .then(setOrder)
                  .catch((e) => setError(e.message))
              }
              onJoin={onJoin}
              onSwitch={handleSwitch}
              onLogout={handleLogout}
              onNotice={onNotice}
            />
          ) : null}
        </ScrollView>
      )}
      {checkoutFooter}
      <CartDockArrival
        visible={
          screen !== "cart" &&
          !(
            screen === "account" &&
            (accountPanel === "activity" || accountPanel === "payments")
          ) &&
          cart.length > 0
        }
        style={M.cartDock}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Voir le panier, ${cartCount} unités, ${quote?.needsQuote || quote?.subtotal == null ? "sur devis" : money(quote.subtotal)}`}
          onPress={() => navigate("cart")}
          style={({ pressed }) => [
            M.cartDockPanel,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={M.cartDockAmount}
            >
              {quote?.needsQuote || quote?.subtotal == null
                ? "Sur devis"
                : money(quote.subtotal).replace(/ DA$/, "")}
              <Text style={{ fontSize: 12 }}>
                {quote?.needsQuote || quote?.subtotal == null ? "" : " DA"}
              </Text>
            </Text>
            <Text numberOfLines={1} style={M.cartDockQuantity}>
              {cartCount} unités · hors livraison
            </Text>
          </View>
          <View style={[M.cartDockAction, appWidth < 360 && { width: 140 }]}>
            <Text style={M.cartDockActionText}>Voir le panier</Text>
            <FigmaImage
              source={require("../assets/figma/mobile-merchant-home-82961.svg")}
              style={{ width: 20, height: 20 }}
            />
          </View>
        </Pressable>
      </CartDockArrival>
      {!(
        screen === "account" &&
        (accountPanel === "activity" || accountPanel === "payments")
      ) ? (
        <View style={M.tabBar}>
          {nav.map((item) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: screen === item.id }}
              key={item.id}
              onPress={() => navigate(item.id)}
              style={({ pressed }) => [M.tab, { opacity: pressed ? 0.6 : 1 }]}
            >
              <View>
                <FigmaImage
                  source={
                    item.id === "catalog"
                      ? require("../assets/figma/mobile-merchant-home-41ec3.svg")
                      : item.id === "offers"
                        ? require("../assets/figma/mobile-merchant-home-dca2a.svg")
                        : item.id === "orders"
                          ? require("../assets/figma/mobile-merchant-home-83fb6.svg")
                          : item.id === "messages"
                            ? require("../assets/figma/mobile-merchant-home-2e2be.svg")
                            : require("../assets/figma/mobile-merchant-home-c5de3.svg")
                  }
                  style={{ width: 24, height: 24 }}
                  tintColor={screen === item.id ? C.green : C.muted}
                />
                {item.id === "cart" && cart.length > 0 ? (
                  <View style={M.tabBadge}>
                    <Text
                      style={{ color: C.white, fontSize: 9, fontWeight: "700" }}
                    >
                      {cart.length}
                    </Text>
                  </View>
                ) : null}
              </View>
              <Text
                style={[
                  M.tabText,
                  {
                    color: screen === item.id ? C.green : C.muted,
                    fontWeight: screen === item.id ? "700" : "500",
                  },
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Modal
        visible={!!selectedProduct}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedProduct(null)}
      >
        <View style={M.overlay}>
          {selectedProduct ? (
            <View style={[M.sheet, { maxHeight: "93%" }]}>
              <View style={M.sheetHandle} />
              <View style={[S.between, { paddingHorizontal: 20 }]}>
                <Text style={[S.label, { color: C.muted }]}>
                  {selectedProduct.brand}
                </Text>
                <Button
                  label="Fermer la fiche produit"
                  icon="close"
                  variant="ghost"
                  onPress={() => setSelectedProduct(null)}
                />
              </View>
              <ScrollView
                contentContainerStyle={{
                  paddingHorizontal: 20,
                  paddingBottom: Math.max(insets.bottom, 20),
                  gap: 15,
                }}
              >
                <ProductImage
                  uri={selectedProduct.imageUrl}
                  name={selectedProduct.name}
                  style={{ height: 235, aspectRatio: undefined }}
                />
                <Text style={M.screenTitle}>{selectedProduct.name}</Text>
                <Text style={S.muted}>{quantityLabel(selectedProduct)}</Text>
                <Text style={[M.price, { fontSize: 22 }]}>
                  {money(selectedProduct.price)}
                </Text>
                {!selectedProduct.offerApproved ? (
                  <Notice>
                    Le prix, le colisage et la disponibilité seront confirmés
                    dans l’offre du grossiste.
                  </Notice>
                ) : null}
                <View style={S.divider} />
                <Info label="Code-barres" value={selectedProduct.barcode} />
                <Info label="Catégorie" value={selectedProduct.category} />
                <View style={{ gap: 12 }}>
                  {cartQuantity(selectedProduct) ? (
                    <QuantityControl
                      disabled={busy}
                      value={cartQuantity(selectedProduct)}
                      minimum={selectedProduct.minimumQuantity || 1}
                      onChange={(n) => changeQuantity(selectedProduct, n)}
                      name={selectedProduct.name}
                    />
                  ) : (
                    <Button
                      disabled={busy}
                      icon="add"
                      onPress={() =>
                        changeQuantity(
                          selectedProduct,
                          selectedProduct.minimumQuantity || 1,
                        )
                      }
                    >
                      Ajouter au panier
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setSelectedProduct(null);
                      navigate("cart");
                    }}
                  >
                    Voir mon panier
                  </Button>
                </View>
                {selectedProduct.sourceUrl ? (
                  <Button
                    variant="ghost"
                    icon="open-outline"
                    onPress={() =>
                      Linking.openURL(selectedProduct.sourceUrl!).catch((e) =>
                        setError(e.message),
                      )
                    }
                  >
                    Voir la fiche source
                  </Button>
                ) : null}
                <Text style={S.small}>
                  Données Open Food Facts · ODbL. Photos des contributeurs · CC
                  BY-SA 3.0. Signalez une différence d’emballage avant de
                  confirmer le devis.
                </Text>
              </ScrollView>
            </View>
          ) : null}
        </View>
      </Modal>
      <Modal
        visible={!!order}
        animationType="slide"
        onRequestClose={() => setOrder(null)}
      >
        {order ? (
          <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
            <View style={M.orderAppBar}>
              <Button
                icon="arrow-back"
                label="Retour aux commandes"
                variant="ghost"
                onPress={() => setOrder(null)}
              />
              <Text style={M.sectionTitle}>Ma commande</Text>
              <Button
                variant="ghost"
                icon="refresh-outline"
                label="Actualiser le détail de la commande"
                onPress={() =>
                  api<Order>(`/orders/${order.id}`)
                    .then(setOrder)
                    .catch((e) => setError(e.message))
                }
              />
            </View>
            <ScrollView
              contentContainerStyle={{
                width: "100%",
                maxWidth: 520,
                alignSelf: "center",
                padding: 16,
                gap: 16,
                paddingBottom: 30,
              }}
            >
              {error ? <Notice error>{error}</Notice> : null}
              {submittedOrder === order.id ? (
                <StateArrival changeKey={order.id}>
                  <View style={M.confirmedOrder}>
                    <View style={S.row}>
                      <Icon name="checkmark-circle" color={C.green} size={30} />
                      <Text style={[S.subheading, { flex: 1 }]}>
                        {order.status === "REQUESTED"
                          ? "Votre demande est reçue."
                          : order.status === "SUBMITTED"
                            ? "Votre commande est reçue."
                            : "Commande enregistrée."}
                      </Text>
                    </View>
                    <Text style={S.text}>
                      {order.status === "REQUESTED"
                        ? "Votre grossiste vous proposera les prix à valider ici."
                        : order.status === "SUBMITTED"
                          ? "Votre grossiste a reçu la commande. Sa confirmation est attendue avant la préparation."
                          : "Retrouvez ici l’état de votre commande, sa préparation, son départ et sa réception."}
                    </Text>
                    <Button
                      small
                      variant="ghost"
                      onPress={() => setSubmittedOrder(null)}
                    >
                      J’ai compris
                    </Button>
                  </View>
                </StateArrival>
              ) : null}
              <View style={M.group}>
                <View style={S.between}>
                  <Text style={S.label}>{order.number}</Text>
                  <Status value={order.status} />
                </View>
                <Text style={[S.small, { marginTop: 7 }]}>
                  {date(order.createdAt, true)}
                </Text>
                <OrderProgress order={order} />
                <Text style={[S.small, { marginTop: 15 }]}>
                  {orderConnected
                    ? "Suivi connecté · actualisation toutes les 15 s"
                    : "Connexion interrompue · dernière information conservée"}
                </Text>
                <Text style={S.small}>
                  Dernière mise à jour :{" "}
                  {date(orderSynced || order.updatedAt, true)}
                </Text>
              </View>
              <OrderAmendments
                orderId={order.id}
                updatedAt={order.updatedAt}
                canWrite={canWrite}
                onUpdated={setOrder}
                onNotice={onNotice}
              />
              {order.status === "QUOTED" ? (
                <View style={M.group}>
                  <Text style={M.sectionTitle}>Votre offre est prête</Text>
                  <Text style={[S.muted, { marginTop: 8 }]}>
                    Vérifiez les quantités et le prix proposé. Votre accord
                    réserve le stock.
                  </Text>
                  <Text style={[S.small, { marginVertical: 13 }]}>
                    Version {order.quoteVersion} · valable jusqu’au{" "}
                    {date(order.quoteValidUntil, true)}
                  </Text>
                  <Button
                    loading={busy}
                    disabled={!canWrite}
                    onPress={() =>
                      orderAction(
                        "accept-quote",
                        { version: order.quoteVersion },
                        "Offre acceptée. Votre commande est confirmée.",
                      )
                    }
                    icon="checkmark"
                  >
                    Accepter · {money(order.total)}
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy || !canWrite}
                    onPress={() =>
                      orderAction(
                        "decline",
                        { reason: "Offre déclinée par le commerçant." },
                        "Offre déclinée.",
                      )
                    }
                  >
                    Décliner cette offre
                  </Button>
                </View>
              ) : order.status === "REQUESTED" ? (
                <Notice>
                  Demande bien reçue. Le devis de votre grossiste apparaîtra ici
                  dès qu’il sera prêt.
                </Notice>
              ) : null}
              <Button
                variant="secondary"
                icon="chatbubble-ellipses-outline"
                onPress={() => {
                  const context = {
                    type: "ORDER" as const,
                    id: order.id,
                    subject: `Commande ${order.number}`,
                  };
                  navigate("messages");
                  setMessageContext(context);
                }}
              >
                Contacter mon grossiste pour cette commande
              </Button>
              {[
                "PREPARING",
                "READY",
                "OUT_FOR_DELIVERY",
                "DELIVERED",
                "PARTIALLY_DELIVERED",
                "DELIVERY_REFUSED",
              ].includes(order.status) ? (
                <MerchantDelivery
                  canWrite={canWrite}
                  order={order}
                  onRefresh={() =>
                    api<Order>(`/orders/${order.id}`)
                      .then(setOrder)
                      .catch((e) => setError(e.message))
                  }
                />
              ) : null}
              <View style={M.group}>
                <Text style={[M.sectionTitle, { marginBottom: 8 }]}>
                  Mes produits
                </Text>
                {order.items.map((item) => (
                  <View key={item.id || item.productId} style={M.orderLine}>
                    <ProductImage
                      uri={item.imageUrl}
                      name={item.name}
                      size={58}
                    />
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[S.text, { fontWeight: "600" }]}>
                        {item.name}
                      </Text>
                      <Text style={S.small}>
                        {item.quantity} unités
                        {item.caseSize && item.caseSize > 1
                          ? ` · colis de ${item.caseSize}`
                          : ""}
                        {item.requestedQuantity !== item.quantity
                          ? ` · ${item.requestedQuantity} demandées`
                          : ""}
                      </Text>
                      {[
                        "DELIVERED",
                        "PARTIALLY_DELIVERED",
                        "DELIVERY_REFUSED",
                      ].includes(order.status) ? (
                        <Text style={S.small}>
                          {item.acceptedQuantity || 0} acceptées ·{" "}
                          {item.refusedQuantity || 0} refusées
                        </Text>
                      ) : null}
                      <Text style={S.label}>{money(item.lineTotal)}</Text>
                    </View>
                  </View>
                ))}
                <View style={[S.between, { paddingTop: 14 }]}>
                  <Text style={S.muted}>Livraison</Text>
                  <Text style={S.label}>
                    {order.deliveryFee == null
                      ? "À confirmer"
                      : money(order.deliveryFee)}
                  </Text>
                </View>
                <View
                  style={[
                    S.between,
                    {
                      marginTop: 16,
                      paddingTop: 15,
                      borderTopWidth: 1,
                      borderColor: C.border,
                    },
                  ]}
                >
                  <Text style={M.sectionTitle}>
                    {order.total == null || order.status === "REQUESTED"
                      ? "Total à confirmer"
                      : order.status === "SUBMITTED"
                        ? "Total transmis"
                        : ["QUOTED", "OFFER_DECLINED"].includes(order.status)
                          ? "Total proposé"
                          : "Total de la commande"}
                  </Text>
                  <Text style={M.sectionTitle}>{money(order.total)}</Text>
                </View>
              </View>
              <OrderGifts orderId={order.id} />
              <View style={M.group}>
                <View style={[S.between, { marginBottom: 17 }]}>
                  <Text style={M.sectionTitle}>Paiement</Text>
                  <Status value={order.paymentStatus} />
                </View>
                <Info label="Encaissé" value={money(order.balance.collected)} />
                <View style={{ height: 12 }} />
                <Info
                  label="Reste dû"
                  value={
                    order.total == null
                      ? "À confirmer"
                      : money(order.balance.remaining)
                  }
                />
                {order.balance.refundDue > 0 ? (
                  <View style={{ marginTop: 12 }}>
                    <Info
                      label="À rembourser"
                      value={money(order.balance.refundDue)}
                    />
                  </View>
                ) : null}
                <Text style={[S.small, { marginTop: 14 }]}>
                  Paiement à la livraison · l’encaissement est enregistré par le
                  livreur ou le grossiste, avec son mode et sa référence.
                </Text>
                {order.payments.map((payment, index) => (
                  <View
                    key={payment.id || index}
                    style={{
                      gap: 4,
                      paddingTop: 14,
                      marginTop: 14,
                      borderTopWidth: 1,
                      borderColor: C.border,
                    }}
                  >
                    <View style={S.between}>
                      <Text style={S.label}>
                        {payment.isRefund
                          ? "Remboursement"
                          : "Règlement enregistré"}
                      </Text>
                      <Text style={S.label}>{money(payment.amount)}</Text>
                    </View>
                    <Text style={S.small}>
                      {(
                        {
                          CASH: "Espèces",
                          TRANSFER: "Virement",
                          CHEQUE: "Chèque",
                          CARD: "Carte",
                        } as Record<string, string>
                      )[payment.method] || payment.method}{" "}
                      · {date(payment.at, true)}
                    </Text>
                    {payment.reference ? (
                      <Text style={S.small}>
                        Référence : {payment.reference}
                      </Text>
                    ) : null}
                  </View>
                ))}
                {order.balance.remaining === 0 &&
                order.balance.collected > 0 ? (
                  <View style={{ marginTop: 14 }}>
                    <Notice>Votre règlement est enregistré. Merci !</Notice>
                  </View>
                ) : null}
              </View>
              <View style={M.group}>
                <Text style={[M.sectionTitle, { marginBottom: 12 }]}>
                  Livraison
                </Text>
                <View style={S.row}>
                  <Icon name="location-outline" color={C.green} />
                  <View style={{ flex: 1 }}>
                    <Text style={S.label}>{order.address?.label}</Text>
                    <Text style={S.muted}>
                      {order.address?.street}, {order.address?.commune}
                    </Text>
                  </View>
                </View>
                {order.note ? (
                  <Text style={[S.muted, { marginTop: 14 }]}>
                    Votre note : {order.note}
                  </Text>
                ) : null}
                {order.adminNote ? (
                  <Text style={[S.muted, { marginTop: 12 }]}>
                    Message du grossiste : {order.adminNote}
                  </Text>
                ) : null}
              </View>
              <MerchantClaims
                canWrite={canWrite}
                order={order}
                onUpdated={setOrder}
                onNotice={onNotice}
              />
              <View style={M.group}>
                <Text style={[M.sectionTitle, { marginBottom: 18 }]}>
                  Historique
                </Text>
                {order.timeline.map((event, index) => (
                  <View
                    key={event.id || index}
                    style={{ flexDirection: "row", gap: 13 }}
                  >
                    <View style={{ alignItems: "center", width: 12 }}>
                      <View
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor:
                            index === order.timeline.length - 1
                              ? C.green
                              : "#ADB5B0",
                          marginTop: 5,
                        }}
                      />
                      {index < order.timeline.length - 1 ? (
                        <View
                          style={{
                            width: 1,
                            flex: 1,
                            minHeight: 30,
                            backgroundColor: C.border,
                            marginTop: 5,
                          }}
                        />
                      ) : null}
                    </View>
                    <View style={{ flex: 1, paddingBottom: 20, gap: 4 }}>
                      <Text style={S.label}>
                        {event.details ||
                          statuses[event.action] ||
                          event.action.replaceAll("_", " ")}
                      </Text>
                      <Text style={S.small}>
                        {event.actor} · {date(event.at, true)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
              <Button
                variant="secondary"
                icon="refresh-outline"
                loading={busy}
                onPress={() =>
                  orderAction(
                    "reorder",
                    {},
                    "Produits remis au panier avec les conditions actuelles.",
                  )
                }
              >
                Commander à nouveau
              </Button>
              <Button
                variant="ghost"
                icon="document-text-outline"
                onPress={() => {
                  const result =
                    Platform.OS === "web"
                      ? Linking.openURL(
                          `${API_ORIGIN}/api/orders/${order.id}/document`,
                        )
                      : Share.share({
                          message: `${order.number}\n${statuses[order.status]}\n${order.items.map((i) => `${i.quantity} × ${i.name}`).join("\n")}\n${money(order.total)}`,
                        });
                  result.catch((e) => setError(e.message));
                }}
              >
                Bon de commande
              </Button>
              {canWrite &&
              ["REQUESTED", "QUOTED", "SUBMITTED", "CONFIRMED"].includes(
                order.status,
              ) ? (
                <Button
                  variant="danger"
                  disabled={busy}
                  onPress={confirmCancel}
                >
                  Annuler la demande
                </Button>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        ) : null}
      </Modal>
      <Modal
        visible={locationOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationOpen(false)}
      >
        <View style={M.overlay}>
          <View
            style={[
              M.sheet,
              {
                padding: 20,
                paddingBottom: Math.max(insets.bottom, 20),
                gap: 16,
              },
            ]}
          >
            <View style={S.between}>
              <Text style={M.sectionTitle}>Livrer à cette adresse</Text>
              <Button
                icon="close"
                label="Fermer les adresses"
                variant="ghost"
                onPress={() => setLocationOpen(false)}
              />
            </View>
            {addresses.map((a) => (
              <Pressable
                key={a.id}
                accessibilityRole="radio"
                accessibilityState={{ selected: a.id === addressId }}
                onPress={() => {
                  setAddressId(a.id);
                  setLocationOpen(false);
                }}
                style={M.addressChoice}
              >
                <Icon
                  name={
                    a.id === addressId ? "radio-button-on" : "radio-button-off"
                  }
                  color={C.green}
                />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={S.label}>{a.label}</Text>
                  <Text style={S.muted}>{a.street}</Text>
                  <Text style={S.small}>
                    {a.commune}, {a.wilaya}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Button
              variant="secondary"
              icon="add"
              disabled={!canManageShop}
              onPress={() => {
                setLocationOpen(false);
                setAddressForm({
                  label: "Mon commerce",
                  commune: "Oran",
                  street: "",
                });
              }}
            >
              Ajouter une adresse
            </Button>
          </View>
        </View>
      </Modal>
      <Modal
        visible={sortOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setSortOpen(false)}
      >
        <View style={M.overlay}>
          <View
            style={[
              M.sheet,
              {
                padding: 20,
                paddingBottom: Math.max(insets.bottom, 20),
                gap: 6,
              },
            ]}
          >
            <View style={S.between}>
              <Text style={M.sectionTitle}>Trier les produits</Text>
              <Button
                icon="close"
                label="Fermer le tri"
                variant="ghost"
                onPress={() => setSortOpen(false)}
              />
            </View>
            {[
              ["featured", "Sélection Toushir"],
              ["name", "Nom du produit"],
              ["newest", "Dernières références"],
              ["price_asc", "Prix croissant"],
              ["price_desc", "Prix décroissant"],
            ].map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected: sort === value }}
                onPress={() => {
                  setSort(value);
                  setPage(1);
                  setSortOpen(false);
                }}
                style={M.addressChoice}
              >
                <Text style={[S.text, { flex: 1 }]}>{label}</Text>
                <Icon
                  name={sort === value ? "radio-button-on" : "radio-button-off"}
                  color={sort === value ? C.green : C.muted}
                />
              </Pressable>
            ))}
            <Text style={[S.small, { marginTop: 10 }]}>
              Les produits sur devis restent séparés des prix confirmés.
            </Text>
          </View>
        </View>
      </Modal>
      <Modal
        visible={!!addressForm}
        transparent
        animationType="slide"
        onRequestClose={() => setAddressForm(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={M.overlay}
        >
          <View style={M.sheet}>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: 20,
                paddingBottom: Math.max(insets.bottom, 20),
                gap: 17,
              }}
            >
              <View style={S.between}>
                <Text style={M.sectionTitle}>Nouvelle adresse</Text>
                <Button
                  label="Fermer l’adresse"
                  icon="close"
                  variant="ghost"
                  onPress={() => setAddressForm(null)}
                />
              </View>
              {error ? <Notice error>{error}</Notice> : null}
              <Field
                label="Nom de l’adresse"
                value={addressForm?.label || ""}
                onChangeText={(v) =>
                  setAddressForm((f) => f && { ...f, label: v })
                }
              />
              <Field
                label="Commune d’Oran"
                value={addressForm?.commune || ""}
                onChangeText={(v) =>
                  setAddressForm((f) => f && { ...f, commune: v })
                }
              />
              <Field
                label="Rue et numéro"
                value={addressForm?.street || ""}
                onChangeText={(v) =>
                  setAddressForm((f) => f && { ...f, street: v })
                }
              />
              <Button loading={busy} onPress={saveAddress}>
                Enregistrer l’adresse
              </Button>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function OrderDeliveryPreview({
  summary,
  isDemo,
  onOpen,
}: {
  summary: OrderSummary;
  isDemo: boolean;
  onOpen: () => void;
}) {
  const [tracking, setTracking] = useState<Tracking | null>(null);
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    let active = true;
    setTracking(null);
    const load = () =>
      api<Tracking>(`/orders/${summary.id}/tracking`)
        .then((value) => {
          if (active) {
            setTracking(value);
            setConnected(true);
          }
        })
        .catch(() => {
          if (active) setConnected(false);
        });
    load();
    const timer = setInterval(load, 15000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [summary.id]);
  const assignment = tracking?.assignment;
  const location = tracking?.location;
  const fresh =
    connected &&
    !!location?.isFresh &&
    Date.now() - new Date(location.capturedAt).getTime() < 90000;
  const status = tracking?.order.status || summary.status;
  const driver = assignment?.driverName;
  const title =
    assignment?.status === "ARRIVED"
      ? "Votre livreur est arrivé"
      : status === "OUT_FOR_DELIVERY"
        ? "Livraison en cours"
        : status === "READY"
          ? "Votre commande est prête"
          : status === "PREPARING"
            ? "Préparation en cours"
            : "Commande enregistrée";
  return (
    <View style={M.deliveryHero}>
      <View style={S.between}>
        <Text style={S.small}>{summary.number}</Text>
        <Status value={status} />
      </View>
      <Text
        style={[S.heading, { fontSize: 28, lineHeight: 32, fontWeight: "700" }]}
      >
        {title}
      </Text>
      <Text style={S.muted}>
        {assignment?.status === "ARRIVED"
          ? "Votre livreur est devant votre magasin."
          : "Horaire d’arrivée non communiqué."}
      </Text>
      <View style={M.deliveryMap}>
        {!location && isDemo ? (
          <FigmaImage
            source={require("../assets/figma/astra-orders-map.svg")}
            contentFit="cover"
            style={{
              width: 330,
              height: 168,
              position: "absolute",
              left: 0,
              top: 0,
            }}
          />
        ) : null}
        <View style={M.deliveryLocationCopy}>
          <FigmaImage
            source={require("../assets/figma/astra-home-truck.svg")}
            style={{ width: 24, height: 24 }}
          />
          <Text style={[S.label, { textAlign: "center" }]}>
            {location
              ? isDemo
                ? "Position de démonstration"
                : fresh
                  ? "Position reçue du livreur"
                  : "Dernière position connue"
              : "Position du livreur indisponible"}
          </Text>
          {location ? (
            <>
              <Text style={S.small}>{date(location.capturedAt, true)}</Text>
              <Button
                small
                variant="ghost"
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps?q=${location.latitude},${location.longitude}`,
                  )
                }
              >
                Ouvrir la position
              </Button>
            </>
          ) : (
            <Text style={[S.small, { textAlign: "center" }]}>
              {isDemo
                ? "Carte illustrative · aucun suivi GPS"
                : connected
                  ? "Le suivi apparaîtra après le partage de sa position."
                  : "Connexion interrompue · réessayez le suivi."}
            </Text>
          )}
        </View>
      </View>
      <View style={[S.row, { gap: 12 }]}>
        <View style={M.deliveryAvatar}>
          <Text style={S.label}>
            {driver
              ? driver
                  .split(" ")
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join("")
              : "—"}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={S.label}>{driver || "Livreur à affecter"}</Text>
          <Text style={S.small}>
            {summary.quantity} unités ·{" "}
            {tracking
              ? `${money(tracking.order.balance.remaining)} à régler`
              : `${money(summary.total)} au total`}
          </Text>
        </View>
        <FigmaImage
          source={require("../assets/figma/astra-home-truck.svg")}
          style={{ width: 24, height: 24 }}
        />
      </View>
      <Button variant="ink" onPress={onOpen} style={{ minHeight: 52 }}>
        Suivre ma livraison
      </Button>
    </View>
  );
}

function CategoryShortcut({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [M.category, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View
        style={[
          M.categoryIcon,
          {
            backgroundColor: active
              ? C.mint
              : /boisson|eau|jus/i.test(label)
                ? C.mint
                : /lait|fromage|laitier|frais/i.test(label)
                  ? "#CCFFFF"
                  : C.bg,
            borderWidth: active ? 1 : 0,
            borderColor: C.green,
          },
        ]}
      >
        <FigmaImage
          source={categoryArtwork(label)}
          style={{ width: 30, height: 30 }}
        />
      </View>
      <Text
        style={[
          M.categoryLabel,
          {
            color: active ? C.green : C.ink,
            fontWeight: active ? "700" : "500",
          },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function CategoryPill({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <FilterPill selected={active} onPress={onPress}>
      {label}
    </FilterPill>
  );
}
function QuantityControl({
  value,
  onChange,
  minimum,
  name,
  compact = false,
  disabled = false,
}: {
  value: number;
  onChange: (n: number) => void;
  minimum: number;
  name: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <View
      style={[
        M.quantity,
        compact ? { width: 132 } : {},
        disabled ? { opacity: 0.45 } : {},
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Diminuer ${name}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() =>
          onChange(value <= minimum ? 0 : Math.max(minimum, value - minimum))
        }
        style={M.quantityButton}
      >
        <Icon
          name={value <= minimum ? "trash-outline" : "remove"}
          color={C.green}
          size={18}
        />
      </Pressable>
      <Text
        accessibilityLabel={`Quantité ${value}`}
        style={[
          S.label,
          { flex: 1, textAlign: "center", color: C.green, fontSize: 14 },
        ]}
      >
        {value}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Augmenter ${name}`}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onChange(value + minimum)}
        style={M.quantityButton}
      >
        <Icon name="add" color={C.green} size={19} />
      </Pressable>
    </View>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={[S.between, { alignItems: "flex-start" }]}>
      <Text style={[S.muted, { flexShrink: 0 }]}>{label}</Text>
      <Text style={[S.text, { textAlign: "right", flexShrink: 1 }]}>
        {value}
      </Text>
    </View>
  );
}
function OrderProgress({ order }: { order: Order }) {
  const steps = [
    {
      label: order.status === "SUBMITTED" ? "Reçue" : "Confirmée",
      icon: "checkmark-circle-outline",
      statuses: ["SUBMITTED", "CONFIRMED"],
    },
    { label: "Préparation", icon: "cube-outline", statuses: ["PREPARING"] },
    { label: "Prête à partir", icon: "bag-check-outline", statuses: ["READY"] },
    {
      label: "En livraison",
      icon: "car-outline",
      statuses: ["OUT_FOR_DELIVERY"],
    },
    {
      label: "Réception",
      icon: "storefront-outline",
      statuses: ["DELIVERED", "PARTIALLY_DELIVERED", "DELIVERY_REFUSED"],
    },
    { label: "Règlement", icon: "wallet-outline", statuses: [] },
  ];
  let active = steps.findIndex((step) => step.statuses.includes(order.status));
  if (active < 0) return null;
  const refused = order.status === "DELIVERY_REFUSED";
  const paid = order.balance.remaining === 0 && order.balance.collected > 0;
  if (paid && active >= 4) active = 5;
  return (
    <StateArrival
      changeKey={`${order.status}-${order.paymentStatus}`}
      style={{ marginTop: 22, gap: 16 }}
    >
      <View style={S.between}>
        <Text style={S.subheading}>
          {refused ? "Réception refusée" : steps[active].label}
        </Text>
        <Text style={S.small}>{Math.min(active + 1, 6)} / 6 étapes</Text>
      </View>
      <MeasuredProgress
        value={(active + 1) / 6}
        label={`Suivi : ${statuses[order.status]}, ${statuses[order.paymentStatus]}`}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap", rowGap: 17 }}>
        {steps.map((step, index) => (
          <View
            key={step.label}
            style={{ width: "33.333%", paddingRight: 6, gap: 5 }}
          >
            <Icon
              name={
                index < active || (index === 5 && paid)
                  ? "checkmark-circle"
                  : step.icon
              }
              size={22}
              color={
                index <= active
                  ? refused && index === 4
                    ? C.red
                    : C.green
                  : C.muted
              }
            />
            <Text
              style={[
                S.small,
                {
                  fontWeight: index === active ? "700" : "400",
                  color: index <= active ? C.ink : C.muted,
                  fontSize: 11,
                },
              ]}
            >
              {index === 4 && order.status === "PARTIALLY_DELIVERED"
                ? "Réception partielle"
                : index === 4 && refused
                  ? "Réception refusée"
                  : step.label}
            </Text>
          </View>
        ))}
      </View>
      <Text style={S.muted}>
        {active === 0
          ? order.status === "SUBMITTED"
            ? "Votre grossiste a reçu la commande. Sa confirmation est attendue avant la préparation."
            : "Votre grossiste a confirmé la commande. Le passage en entrepôt est en préparation."
          : active === 1
            ? "L’entrepôt rassemble vos produits. Les quantités préparées apparaissent dans le suivi."
            : active === 2
              ? "Les produits sont prêts. Le départ sera affiché dès la prise en charge par le livreur."
              : active === 3
                ? "Suivez le livreur et vérifiez les produits à son arrivée."
                : active === 4
                  ? "Les quantités réellement reçues sont enregistrées. Consultez le solde de votre commande."
                  : "La réception et le règlement sont enregistrés."}
      </Text>
    </StateArrival>
  );
}

const M = StyleSheet.create({
  orderFilterPill: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 24,
    justifyContent: "center",
  },
  orderFilterText: { ...S.text, fontSize: 12, lineHeight: 17 },
  recentOrder: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    minHeight: 84,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: C.border,
  },
  deliveryHero: {
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 16,
    gap: 16,
    minHeight: 447,
  },
  deliveryMap: {
    height: 168,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.white,
  },
  deliveryLocationCopy: {
    padding: 12,
    gap: 6,
    alignItems: "center",
    backgroundColor: "#FFFFFFE8",
    borderRadius: 12,
    maxWidth: "90%",
  },
  deliveryAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.white,
    alignItems: "center",
    justifyContent: "center",
  },
  cartDock: {
    height: 64,
    paddingHorizontal: 20,
    justifyContent: "center",
    backgroundColor: C.white,
  },
  cartDockPanel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 56,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    backgroundColor: C.white,
    shadowColor: C.forest,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  cartDockAmount: {
    ...S.label,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
  },
  cartDockQuantity: {
    ...S.small,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  cartDockAction: {
    width: 152,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.action,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cartDockActionText: {
    ...S.label,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  confirmedOrder: {
    backgroundColor: C.mint,
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  app: {
    flex: 1,
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    borderLeftWidth: Platform.OS === "web" ? 1 : 0,
    borderRightWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "#E7EAE8",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
    borderColor: "#E7EBE7",
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F6F4",
  },
  location: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingLeft: 10,
  },
  locationSmall: {
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 15,
    color: C.muted,
  },
  locationName: {
    fontFamily: "Inter",
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 18,
    color: "#151917",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F4",
    borderRadius: 11,
    paddingLeft: 13,
    marginTop: 11,
  },
  searchInput: {
    fontFamily: "Inter",
    color: "#151917",
    flex: 1,
    minWidth: 0,
    height: 50,
    fontSize: 13,
    paddingVertical: 12,
  },
  iconButton: {
    width: 43,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  demoStrip: {
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E7EBE7",
    paddingHorizontal: 16,
    minHeight: 33,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  demoText: {
    fontFamily: "Inter",
    color: C.muted,
    fontSize: 11,
    lineHeight: 16,
  },
  screenTitle: {
    fontFamily: "Inter",
    fontSize: 23,
    fontWeight: "700",
    lineHeight: 30,
    letterSpacing: -0.45,
    color: "#151917",
  },
  sectionTitle: {
    fontFamily: "Inter",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    letterSpacing: -0.25,
    color: "#151917",
  },
  valueStrip: {
    marginTop: 0,
    marginBottom: 4,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    paddingVertical: 12,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  valueTitle: {
    fontFamily: "Inter",
    color: "#151917",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  valueText: {
    fontFamily: "Inter",
    color: C.muted,
    fontSize: 12,
    lineHeight: 17,
  },
  categoryRail: { paddingTop: 0, paddingBottom: 8, gap: 12 },
  category: { width: 81.5, alignItems: "center", gap: 8 },
  categoryIcon: {
    width: 81.5,
    height: 60,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  categoryLabel: {
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    minHeight: 15,
  },
  sort: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 44,
    paddingLeft: 12,
    paddingRight: 2,
  },
  productCard: { backgroundColor: "#FFFFFF", overflow: "hidden" },
  packshot: { backgroundColor: "#FFFFFF", paddingTop: 0, position: "relative" },
  favorite: {
    position: "absolute",
    top: 3,
    right: 2,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFFDD",
    borderRadius: 22,
  },
  productBody: { padding: 0, paddingTop: 7, gap: 7, flex: 1 },
  brand: {
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
    fontWeight: "500",
  },
  productName: {
    fontFamily: "Inter",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
    color: "#151917",
    minHeight: 38,
  },
  pack: {
    fontFamily: "Inter",
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
    marginBottom: 0,
  },
  price: {
    fontFamily: "Inter",
    fontSize: 18,
    lineHeight: 25,
    fontWeight: "700",
    color: "#151917",
    marginTop: "auto",
    marginBottom: 5,
  },
  addButton: {
    minHeight: 44,
    width: 44,
    marginRight: -5,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonFace: {
    height: 34,
    width: 34,
    borderRadius: 17,
    backgroundColor: C.ink,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: {
    fontFamily: "Inter",
    color: "#087F4F",
    fontSize: 12,
    fontWeight: "700",
    lineHeight: 18,
  },
  quantity: {
    height: 44,
    backgroundColor: "#F4F8F5",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#D2E3D8",
    flexDirection: "row",
    alignItems: "center",
  },
  quantityButton: {
    minWidth: 42,
    height: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  group: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E7EBE7",
  },
  cartRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingVertical: 15,
    borderColor: "#E7EBE7",
  },
  checkoutFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderColor: "#E7EBE7",
    backgroundColor: "#FFFFFF",
  },
  basketBar: {
    marginHorizontal: 16,
    marginBottom: 10,
    marginTop: 7,
    backgroundColor: "#087F4F",
    minHeight: 49,
    borderRadius: 10,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  basketCount: {
    minWidth: 25,
    minHeight: 25,
    borderRadius: 6,
    backgroundColor: "#FFFFFF22",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBar: {
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: "#E7EBE7",
    paddingTop: 7,
    paddingBottom: 7,
  },
  tab: {
    flex: 1,
    minHeight: 54,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
  tabText: { fontFamily: "Inter", fontSize: 10, lineHeight: 14 },
  tabBadge: {
    position: "absolute",
    right: -8,
    top: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#087F4F",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: "#FFFFFF",
  },
  orderCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E7EBE7",
    borderRadius: 12,
    padding: 16,
  },
  orderPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderColor: "#E7EBE7",
  },
  orderAppBar: {
    minHeight: 60,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: "#E7EBE7",
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
  },
  orderLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 13,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "#E7EBE7",
  },
  shopAvatar: {
    width: 55,
    height: 55,
    borderRadius: 15,
    backgroundColor: "#F2F5F3",
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    width: "100%",
    maxWidth: 520,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "94%",
    overflow: "hidden",
  },
  sheetHandle: {
    width: 33,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#D9DFDB",
    alignSelf: "center",
    marginTop: 9,
    marginBottom: 8,
  },
  addressChoice: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#E7EBE7",
    minHeight: 50,
  },
});
