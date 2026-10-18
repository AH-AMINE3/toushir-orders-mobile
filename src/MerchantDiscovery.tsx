import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { api, Page, Product } from "./api";
import { Button, Empty, Field, Icon, Notice, ProductImage } from "./components";
import { C, S } from "./theme";

export type DiscoveryPanel = "categories" | "brands" | "filters" | "scanner";
export type CatalogFilters = {
  category: string;
  brand: string;
  sort: string;
  inStock: boolean;
};
export type Category = { id: string; name: string; count: number };
export function categoryArtwork(name: string): number {
  if (/épicerie/i.test(name))
    return require("../assets/figma/mobile-merchant-home-4dda0.svg");
  if (/bébé/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-65173.svg");
  if (/café|thé/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-69bd9.svg");
  if (/petit-déj|boulanger/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-2a51f.svg");
  if (/pâte|riz|céréal/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-48384.svg");
  if (/lait|fromage|yaourt/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-8b747.svg");
  if (/biscuit|snack/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-91e4a.svg");
  if (/confiser|chocolat/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-b06c7.svg");
  if (/eaux|huile|sauce|épice/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-c97cd.svg");
  if (/boisson|jus/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-55d78.svg");
  if (/hygiène/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-3caf6.svg");
  if (/entretien/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-bf5f0.svg");
  if (/pâtisser/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-523ab.svg");
  if (/surgel/i.test(name))
    return require("../assets/figma/mobile-merchant-categories-f1e73.svg");
  return require("../assets/figma/mobile-merchant-categories-4dda0.svg");
}
const sortOptions = [
  { id: "featured", label: "Nos sélections" },
  { id: "name", label: "Nom du produit" },
  { id: "price_asc", label: "Prix croissant" },
  { id: "price_desc", label: "Prix décroissant" },
];
const titles = {
  categories: "Tous les rayons",
  brands: "Toutes les marques",
  filters: "Filtres",
  scanner: "Scanner un produit",
};
function Choice({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [
        D.choice,
        {
          backgroundColor: selected ? C.pale : C.bg,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <Icon
        name={selected ? "radio-button-on" : "radio-button-off"}
        color={selected ? C.green : C.muted}
        size={20}
      />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={S.label}>{title}</Text>
        {detail ? <Text style={S.small}>{detail}</Text> : null}
      </View>
    </Pressable>
  );
}
export default function MerchantDiscovery({
  panel,
  categories,
  filters,
  query,
  onClose,
  onApply,
  onProduct,
}: {
  panel: DiscoveryPanel;
  categories: Category[];
  filters: CatalogFilters;
  query: string;
  onClose: () => void;
  onApply: (filters: CatalogFilters) => void;
  onProduct: (product: Product) => void;
}) {
  const [search, setSearch] = useState(""),
    [brands, setBrands] = useState<{ name: string; count: number }[]>([]),
    [draft, setDraft] = useState(filters),
    [count, setCount] = useState<number | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(false);
  const [barcode, setBarcode] = useState(""),
    [camera, setCamera] = useState(false),
    [found, setFound] = useState<Product | null>(null),
    [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  useEffect(() => {
    let active = true;
    if (panel === "brands" || panel === "filters") {
      setLoading(true);
      api<{ name: string; count: number }[]>("/brands")
        .then((value) => active && setBrands(value))
        .catch((e) => active && setError(e.message))
        .finally(() => active && setLoading(false));
    }
    return () => {
      active = false;
    };
  }, [panel]);
  useEffect(() => {
    if (panel !== "filters") return;
    let active = true;
    setCount(null);
    const timer = setTimeout(() => {
      api<Page<Product>>(
        `/products?pageSize=1&q=${encodeURIComponent(query)}&category=${encodeURIComponent(draft.category)}&brand=${encodeURIComponent(draft.brand)}&inStock=${draft.inStock}`,
      )
        .then((r) => active && setCount(r.total))
        .catch((e) => active && setError(e.message));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [panel, draft, query]);
  async function scan(value = barcode) {
    if (scanning) return;
    const code = value.replace(/\s/g, "");
    if (!/^\d{8,14}$/.test(code)) {
      setError("Saisissez un code-barres de 8 à 14 chiffres.");
      return;
    }
    setCamera(false);
    setBarcode(code);
    setScanning(true);
    setFound(null);
    setError("");
    try {
      const result = await api<Page<Product>>(
        "/products?q=" + encodeURIComponent(code) + "&pageSize=5",
      );
      const exact = result.items.find((p) => p.barcode === code);
      if (exact) setFound(exact);
      else
        setError(
          "Ce code-barres n’est pas présent au catalogue. Essayez une recherche par nom.",
        );
    } catch (e: any) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  }
  return (
    <View style={{ flex: 1, backgroundColor: C.white }}>
      <View style={D.header}>
        <Button
          variant="ghost"
          icon="arrow-back"
          label="Retour au catalogue"
          onPress={onClose}
        />
        <Text
          accessibilityRole="header"
          style={[S.subheading, { flex: 1, textAlign: "center" }]}
        >
          {titles[panel]}
        </Text>
        <Button
          variant="ghost"
          icon="close"
          label="Fermer la découverte"
          onPress={onClose}
        />
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: 20, gap: 20, paddingBottom: 32 }}
      >
        {error ? <Notice error>{error}</Notice> : null}
        {panel === "categories" ? (
          <>
            <Field
              label="Rechercher un rayon"
              value={search}
              onChangeText={setSearch}
              placeholder="Boissons, café, épicerie…"
            />
            <Text style={S.heading}>Tout pour votre magasin.</Text>
            <View style={D.grid}>
              {categories
                .filter((c) =>
                  c.name
                    .toLocaleLowerCase("fr")
                    .includes(search.toLocaleLowerCase("fr")),
                )
                .map((c) => (
                  <Pressable
                    key={c.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${c.name}, ${c.count} produits`}
                    onPress={() => onApply({ ...filters, category: c.id })}
                    style={({ pressed }) => [
                      D.category,
                      { opacity: pressed ? 0.65 : 1 },
                    ]}
                  >
                    <View style={D.artwork}>
                      <Image
                        source={categoryArtwork(c.name)}
                        style={{ width: 30, height: 30 }}
                        contentFit="contain"
                        accessible={false}
                      />
                    </View>
                    <Text
                      style={[S.label, { textAlign: "center", fontSize: 12 }]}
                    >
                      {c.name}
                    </Text>
                    <Text style={[S.small, { fontSize: 11 }]}>
                      {c.count} références
                    </Text>
                  </Pressable>
                ))}
            </View>
            <Button
              variant="secondary"
              onPress={() =>
                onApply({
                  category: "",
                  brand: "",
                  sort: "featured",
                  inStock: false,
                })
              }
            >
              Explorer tout le catalogue
            </Button>
          </>
        ) : null}
        {panel === "brands" ? (
          <>
            <Field
              label="Rechercher une marque"
              value={search}
              onChangeText={setSearch}
              placeholder="Nom de la marque"
              style={{ height: 48, minHeight: 48, flexShrink: 0 }}
            />
            <Text style={S.small}>{brands.length} marques au catalogue</Text>
            {loading ? <ActivityIndicator color={C.green} /> : null}
            {brands
              .filter((b) =>
                b.name
                  .toLocaleLowerCase("fr")
                  .includes(search.toLocaleLowerCase("fr")),
              )
              .slice(0, 100)
              .map((b) => (
                <Pressable
                  key={b.name}
                  accessibilityRole="button"
                  onPress={() => onApply({ ...filters, brand: b.name })}
                  style={D.brand}
                >
                  <View style={D.monogram}>
                    <Text style={[S.subheading, { color: C.green }]}>
                      {b.name.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={S.label}>{b.name}</Text>
                    <Text style={S.small}>{b.count} références</Text>
                  </View>
                  <Icon name="chevron-forward" size={18} />
                </Pressable>
              ))}
            {brands.length > 100 && !search ? (
              <Text style={S.small}>
                Recherchez une marque pour consulter les autres résultats.
              </Text>
            ) : null}
          </>
        ) : null}
        {panel === "filters" ? (
          <>
            {query ? <Text style={S.muted}>Recherche : {query}</Text> : null}
            <Text style={S.subheading}>Rayon</Text>
            <ScrollView
              horizontal
              style={{ flexGrow: 0, flexShrink: 0, minHeight: 44 }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Choice
                title="Tous les rayons"
                selected={!draft.category}
                onPress={() => setDraft({ ...draft, category: "" })}
              />
              {categories.map((c) => (
                <Choice
                  key={c.id}
                  title={c.name}
                  selected={draft.category === c.id}
                  onPress={() => setDraft({ ...draft, category: c.id })}
                />
              ))}
            </ScrollView>
            <Text style={S.subheading}>Marque</Text>
            <Field
              label="Trouver une marque"
              value={search}
              onChangeText={setSearch}
              placeholder="Nom de la marque"
              style={{ height: 48, minHeight: 48, flexShrink: 0 }}
            />
            <ScrollView
              horizontal
              style={{ flexGrow: 0, flexShrink: 0, minHeight: 44 }}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              <Choice
                title="Toutes les marques"
                selected={!draft.brand}
                onPress={() => setDraft({ ...draft, brand: "" })}
              />
              {brands
                .filter(
                  (b) =>
                    b.name.toLowerCase().includes(search.toLowerCase()) ||
                    b.name === draft.brand,
                )
                .slice(0, 30)
                .map((b) => (
                  <Choice
                    key={b.name}
                    title={b.name}
                    selected={draft.brand === b.name}
                    onPress={() => setDraft({ ...draft, brand: b.name })}
                  />
                ))}
            </ScrollView>
            <Text style={S.subheading}>Disponibilité</Text>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: draft.inStock }}
              onPress={() => setDraft({ ...draft, inStock: !draft.inStock })}
              style={D.choice}
            >
              <Icon
                name={draft.inStock ? "checkbox" : "square-outline"}
                color={C.green}
              />
              <Text style={S.text}>Stock confirmé disponible</Text>
            </Pressable>
            <Text style={S.subheading}>Trier les résultats</Text>
            {sortOptions.map((x) => (
              <Choice
                key={x.id}
                title={x.label}
                selected={draft.sort === x.id}
                onPress={() => setDraft({ ...draft, sort: x.id })}
              />
            ))}
            <Text style={S.small}>
              Le conditionnement exact est indiqué sur chaque produit et dans le
              panier.
            </Text>
            <Button variant="ink" onPress={() => onApply(draft)}>
              {count == null
                ? "Afficher les produits"
                : `Afficher les ${count} produits`}
            </Button>
            <Button
              variant="ghost"
              onPress={() =>
                setDraft({
                  category: "",
                  brand: "",
                  sort: "featured",
                  inStock: false,
                })
              }
            >
              Réinitialiser les filtres
            </Button>
          </>
        ) : null}
        {panel === "scanner" ? (
          <>
            <Text style={S.heading}>Un code. Le bon produit.</Text>
            <Text style={S.muted}>
              Scannez le code-barres de l’emballage ou saisissez-le pour
              retrouver sa fiche exacte.
            </Text>
            {camera ? (
              <View
                style={{
                  height: 300,
                  borderRadius: 16,
                  overflow: "hidden",
                  backgroundColor: C.ink,
                }}
              >
                <CameraView
                  style={{ flex: 1 }}
                  barcodeScannerSettings={{
                    barcodeTypes: [
                      "ean13",
                      "ean8",
                      "upc_a",
                      "upc_e",
                      "code128",
                    ],
                  }}
                  onBarcodeScanned={({ data }) => void scan(data)}
                />
              </View>
            ) : (
              <View style={D.scanIllustration}>
                <Icon name="barcode-outline" size={96} color={C.green} />
              </View>
            )}
            <Button
              variant="secondary"
              icon={camera ? "close" : "camera-outline"}
              onPress={async () => {
                if (camera) {
                  setCamera(false);
                  return;
                }
                setError("");
                try {
                  const next = permission?.granted
                    ? permission
                    : await requestPermission();
                  if (next.granted) setCamera(true);
                  else
                    setError(
                      "L’accès à la caméra est désactivé. Vous pouvez saisir le code-barres ci-dessous.",
                    );
                } catch {
                  setError(
                    "Caméra indisponible dans ce navigateur. Saisissez le code-barres ci-dessous.",
                  );
                }
              }}
            >
              {camera ? "Arrêter la caméra" : "Activer la caméra"}
            </Button>
            <Field
              label="Code-barres du produit"
              value={barcode}
              onChangeText={(v) => {
                setBarcode(v);
                setFound(null);
                setError("");
              }}
              keyboardType="number-pad"
              placeholder="8 à 14 chiffres"
              onSubmitEditing={() => void scan()}
            />
            <Button loading={scanning} onPress={() => void scan()}>
              Rechercher ce code-barres
            </Button>
            {found ? (
              <View style={D.result}>
                <ProductImage
                  uri={found.imageUrl}
                  name={found.name}
                  size={100}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  <Text style={S.small}>Produit reconnu</Text>
                  <Text style={S.subheading}>{found.name}</Text>
                  <Text style={S.muted}>{found.brand}</Text>
                  <Button variant="ink" onPress={() => onProduct(found!)}>
                    Voir ce produit
                  </Button>
                </View>
              </View>
            ) : null}
            <Text style={S.small}>
              La caméra sert uniquement à lire un code. Aucune photo n’est
              envoyée au serveur.
            </Text>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}
const D = StyleSheet.create({
  header: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 8,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 14 },
  category: {
    width: "30%",
    minWidth: 92,
    alignItems: "center",
    gap: 6,
    marginBottom: 12,
  },
  artwork: {
    width: "100%",
    height: 72,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.mint,
  },
  choice: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 15,
    borderRadius: 12,
    minHeight: 54,
    backgroundColor: C.bg,
  },
  brand: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
    borderColor: C.border,
    paddingVertical: 10,
  },
  monogram: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: C.pale,
    alignItems: "center",
    justifyContent: "center",
  },
  scanIllustration: {
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: C.bg,
  },
  result: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 20,
    borderTopWidth: 1,
    borderColor: C.border,
  },
});
