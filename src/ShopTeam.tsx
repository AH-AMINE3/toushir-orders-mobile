import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { api, API_ORIGIN, date, post, Session } from "./api";
import { Button, Field, Icon, Logo, Notice } from "./components";
import { C, S } from "./theme";

type Role = "MANAGER" | "BUYER" | "VIEWER";
type Member = {
  id: string;
  accountId: string;
  name: string;
  email?: string;
  role: Role;
  status: string;
  version: number;
};
type Invitation = {
  id: string;
  email: string;
  role: Role;
  version: number;
  status: string;
  expiresAt: string;
};
type Team = {
  shop: { id: string; name: string; validUntil?: string | null };
  actor: {
    id: string;
    role: string;
    canManage: boolean;
    canInviteManager: boolean;
  };
  owner: { id: string; name: string };
  members: Member[];
  invitations: Invitation[];
  events: { id: string; kind: string; actorId: string; at: string }[];
  notice: string;
};
export const shopRoleNames: Record<string, string> = {
  OWNER: "Propriétaire",
  MANAGER: "Responsable",
  BUYER: "Acheteur",
  VIEWER: "Lecture seule",
};
const roleDetails: Record<Role, string> = {
  MANAGER:
    "Commandes, réceptions, adresses et cadeaux. Invite des acheteurs et lecteurs.",
  BUYER: "Demande des devis, commande et confirme les quantités reçues.",
  VIEWER:
    "Consulte les commandes, les prix et le suivi. Aucun engagement au nom du magasin.",
};
function Roles({
  value,
  onChange,
  manager,
  disabled,
}: {
  value: Role;
  onChange: (role: Role) => void;
  manager: boolean;
  disabled: boolean;
}) {
  return (
    <View accessibilityLabel="Choisir les droits du membre" style={{ gap: 0 }}>
      {(["BUYER", "VIEWER", ...(manager ? ["MANAGER"] : [])] as Role[]).map(
        (role) => (
          <Pressable
            key={role}
            accessibilityRole="radio"
            accessibilityState={{ checked: value === role, disabled }}
            disabled={disabled}
            onPress={() => onChange(role)}
            style={[
              T.role,
              { backgroundColor: value === role ? C.pale : C.white },
            ]}
          >
            <Icon
              name={value === role ? "radio-button-on" : "radio-button-off"}
              color={value === role ? C.green : C.muted}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={S.label}>{shopRoleNames[role]}</Text>
              <Text style={[S.small, value === role && { color: C.ink }]}>
                {roleDetails[role]}
              </Text>
            </View>
          </Pressable>
        ),
      )}
    </View>
  );
}
export default function ShopTeam({
  session,
  onNotice,
}: {
  session: Session;
  onNotice: (message: string) => void;
}) {
  const [team, setTeam] = useState<Team | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<Role>("BUYER"),
    [inviteOpen, setInviteOpen] = useState(false),
    [link, setLink] = useState("");
  const [selected, setSelected] = useState<Member | null>(null),
    [nextRole, setNextRole] = useState<Role>("BUYER"),
    [reason, setReason] = useState(""),
    [revokeInvite, setRevokeInvite] = useState<Invitation | null>(null);
  const pending = useRef(false);
  async function refresh() {
    try {
      setTeam(await api<Team>("/shop/team"));
      setError("");
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    refresh();
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
  const canManage = !!team?.actor.canManage;
  async function copy() {
    try {
      if (Platform.OS === "web") {
        await navigator.clipboard.writeText(link);
        onNotice("Lien privé copié. Transmettez-le à cette personne.");
      } else await Share.share({ message: link });
    } catch {
      setError(
        "La copie n’a pas abouti. Réessayez depuis un navigateur qui autorise le presse-papiers.",
      );
    }
  }
  return (
    <View style={T.wrap}>
      <View style={{ gap: 8 }}>
        <Text style={T.title}>
          {team?.shop.name || session.user.shopName || "Votre magasin"}
        </Text>
        <Text style={S.small}>
          Vous êtes connecté en tant que {session.user.name} ·{" "}
          {
            shopRoleNames[
              team?.actor.role || session.user.shop?.role || "OWNER"
            ]
          }
          .
        </Text>
      </View>
      {error && !inviteOpen && !selected && !revokeInvite ? (
        <View style={{ gap: 8 }}>
          <Notice error>{error}</Notice>
          <Button
            small
            style={{ minHeight: 44 }}
            variant="ghost"
            disabled={busy}
            onPress={refresh}
          >
            Actualiser les accès
          </Button>
        </View>
      ) : null}
      <Notice>
        Les commandes et les réceptions appartiennent au magasin. Chaque
        personne garde son compte, son mot de passe et son panier.
      </Notice>
      {!team && !error ? (
        <Text style={S.muted}>Chargement de l’équipe…</Text>
      ) : team ? (
        <>
          <View>
            <View style={T.person}>
              <View style={[S.row, { alignItems: "flex-start" }]}>
                <View style={T.avatar}>
                  <Icon name="storefront-outline" color={C.green} />
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  <Text style={S.label}>{team.owner.name}</Text>
                  <Text style={S.small}>Propriétaire · accès principal</Text>
                </View>
              </View>
            </View>
            {team.members.map((member) => (
              <View key={member.id} style={T.person}>
                <View style={[S.between, { alignItems: "flex-start" }]}>
                  <View style={{ flex: 1, gap: 5 }}>
                    <Text style={S.label}>
                      {member.name}
                      {member.accountId === session.user.id ? " · vous" : ""}
                    </Text>
                    <Text style={S.small}>
                      {shopRoleNames[member.role]} ·{" "}
                      {member.status === "ACTIVE" ? "Actif" : "Accès révoqué"}
                    </Text>
                    {member.email ? (
                      <Text selectable style={S.small}>
                        {member.email}
                      </Text>
                    ) : null}
                  </View>
                  {member.status === "ACTIVE" &&
                  canManage &&
                  (team.actor.canInviteManager || member.role !== "MANAGER") ? (
                    <Button
                      small
                      style={{ minHeight: 44 }}
                      variant="ghost"
                      label={`Gérer ${member.name}`}
                      disabled={busy}
                      onPress={() => {
                        setSelected(member);
                        setNextRole(member.role);
                        setReason("");
                        setRevokeInvite(null);
                        setInviteOpen(false);
                        setError("");
                      }}
                    >
                      Gérer
                    </Button>
                  ) : null}
                </View>
                {selected?.id === member.id ? (
                  <View style={T.edit}>
                    <Text style={T.section}>Modifier cet accès</Text>
                    <Roles
                      value={nextRole}
                      onChange={setNextRole}
                      manager={team.actor.canInviteManager}
                      disabled={busy}
                    />
                    <Field
                      label="Motif du changement"
                      value={reason}
                      editable={!busy}
                      onChangeText={setReason}
                      multiline
                      placeholder="Par exemple : changement de mission"
                    />
                    {error ? <Notice error>{error}</Notice> : null}
                    <Button
                      disabled={
                        busy ||
                        reason.trim().length < 8 ||
                        nextRole === member.role
                      }
                      loading={busy}
                      onPress={() =>
                        run(async () => {
                          setTeam(
                            await post<Team>(
                              `/shop/team/members/${member.id}/role`,
                              {
                                version: member.version,
                                role: nextRole,
                                reason,
                              },
                            ),
                          );
                          setSelected(null);
                          onNotice(
                            "Droits modifiés. Cette personne devra se reconnecter.",
                          );
                        })
                      }
                    >
                      Enregistrer les droits
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busy || reason.trim().length < 8}
                      onPress={() =>
                        run(async () => {
                          setTeam(
                            await post<Team>(
                              `/shop/team/members/${member.id}/revoke`,
                              { version: member.version, reason },
                            ),
                          );
                          setSelected(null);
                          onNotice(
                            "Accès révoqué. L’historique du magasin est conservé.",
                          );
                        })
                      }
                    >
                      Révoquer cet accès
                    </Button>
                    <Text style={S.small}>
                      La révocation coupe les sessions et invalide ses codes de
                      réception inutilisés. Les commandes déjà acceptées sont
                      conservées.
                    </Text>
                    <Button
                      variant="ghost"
                      disabled={busy}
                      onPress={() => setSelected(null)}
                    >
                      Conserver cet accès
                    </Button>
                  </View>
                ) : null}
              </View>
            ))}
            {!team.members.length ? (
              <View style={T.person}>
                <Text style={S.label}>Vous gérez le magasin seul</Text>
                <Text style={[S.muted, { marginTop: 6 }]}>
                  Invitez une personne de confiance avec les droits dont elle a
                  besoin.
                </Text>
              </View>
            ) : null}
          </View>
          {canManage ? (
            <>
              {!inviteOpen ? (
                <Button
                  icon="person-add-outline"
                  variant="ink"
                  disabled={busy}
                  onPress={() => {
                    setInviteOpen(true);
                    setSelected(null);
                    setRevokeInvite(null);
                    setLink("");
                    setError("");
                  }}
                >
                  Inviter une personne
                </Button>
              ) : (
                <View style={T.form}>
                  <Text style={T.section}>Un accès personnel</Text>
                  <Field
                    label="E-mail de la personne"
                    value={email}
                    editable={!busy}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    placeholder="prenom@exemple.dz"
                  />
                  <Roles
                    value={role}
                    onChange={setRole}
                    manager={team.actor.canInviteManager}
                    disabled={busy}
                  />
                  <Text style={S.small}>
                    Le lien est à usage unique, valable au maximum 24 h et
                    limité à la durée d’accès du magasin. La personne choisira
                    elle-même son mot de passe.
                  </Text>
                  {error ? <Notice error>{error}</Notice> : null}
                  <Button
                    variant="ink"
                    loading={busy}
                    disabled={!/^\S+@\S+\.\S+$/.test(email)}
                    onPress={() =>
                      run(async () => {
                        const result = await post<{ joinPath: string }>(
                          "/shop/team/invitations",
                          {
                            email,
                            role,
                            expiresAt: new Date(
                              Math.min(
                                Date.now() + 24 * 3600000,
                                team.shop.validUntil
                                  ? Date.parse(team.shop.validUntil)
                                  : Infinity,
                              ),
                            ).toISOString(),
                          },
                        );
                        setLink(
                          (API_ORIGIN ||
                            (Platform.OS === "web"
                              ? window.location.origin
                              : "")) + result.joinPath,
                        );
                        setInviteOpen(false);
                        setEmail("");
                        await refresh();
                        onNotice(
                          "Invitation créée. Aucun message externe n’a été envoyé.",
                        );
                      })
                    }
                  >
                    Créer le lien privé
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={busy}
                    onPress={() => setInviteOpen(false)}
                  >
                    Annuler l’invitation
                  </Button>
                </View>
              )}
              {link ? (
                <View style={T.link}>
                  <Icon name="link-outline" color={C.green} />
                  <Text style={S.label}>Votre lien privé est prêt</Text>
                  <Text style={S.small}>
                    Partagez-le uniquement avec la personne invitée. Le lien ne
                    sera plus affiché après avoir quitté cet écran.
                  </Text>
                  <Button variant="secondary" onPress={copy}>
                    {Platform.OS === "web"
                      ? "Copier le lien privé"
                      : "Partager le lien privé"}
                  </Button>
                  <Button
                    small
                    style={{ minHeight: 44 }}
                    variant="ghost"
                    onPress={() => setLink("")}
                  >
                    Masquer le lien
                  </Button>
                </View>
              ) : null}
              {team.invitations.length ? (
                <View style={{ gap: 8 }}>
                  <Text style={T.section}>Invitations</Text>
                  {team.invitations.map((invite) => (
                    <View key={invite.id} style={T.person}>
                      <Text style={S.label}>{invite.email}</Text>
                      <Text style={[S.small, { marginTop: 5 }]}>
                        {shopRoleNames[invite.role]} ·{" "}
                        {
                          (
                            {
                              PENDING: "En attente",
                              ACCEPTED: "Rejointe",
                              REVOKED: "Révoquée",
                              EXPIRED: "Expirée",
                            } as Record<string, string>
                          )[invite.status]
                        }
                      </Text>
                      {invite.status === "PENDING" ? (
                        <>
                          <Text style={S.small}>
                            Valable jusqu’au {date(invite.expiresAt, true)}
                          </Text>
                          {team.actor.canInviteManager ||
                          invite.role !== "MANAGER" ? (
                            <Button
                              small
                              style={{ minHeight: 44 }}
                              variant="ghost"
                              disabled={busy}
                              label={`Révoquer l’invitation de ${invite.email}`}
                              onPress={() => {
                                setRevokeInvite(invite);
                                setReason("");
                                setSelected(null);
                                setInviteOpen(false);
                                setError("");
                              }}
                            >
                              Révoquer l’invitation
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                      {revokeInvite?.id === invite.id ? (
                        <View style={T.edit}>
                          <Field
                            label="Motif de la révocation"
                            value={reason}
                            editable={!busy}
                            onChangeText={setReason}
                          />
                          {error ? <Notice error>{error}</Notice> : null}
                          <Button
                            variant="danger"
                            disabled={busy || reason.trim().length < 8}
                            onPress={() =>
                              run(async () => {
                                setTeam(
                                  await post<Team>(
                                    `/shop/team/invitations/${invite.id}/revoke`,
                                    { version: invite.version, reason },
                                  ),
                                );
                                setRevokeInvite(null);
                                setLink("");
                                onNotice("Invitation révoquée.");
                              })
                            }
                          >
                            Confirmer la révocation du lien
                          </Button>
                          <Button
                            variant="ghost"
                            disabled={busy}
                            onPress={() => setRevokeInvite(null)}
                          >
                            Garder l’invitation
                          </Button>
                        </View>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
              {team.events.length ? (
                <View style={{ gap: 12 }}>
                  <Text style={T.section}>Historique des accès</Text>
                  {team.events.slice(0, 8).map((event) => (
                    <View key={event.id} style={{ gap: 4 }}>
                      <Text style={S.text}>
                        {(
                          {
                            SHOP_MEMBER_INVITED: "Invitation créée",
                            SHOP_MEMBER_JOINED: "Membre rejoint",
                            SHOP_MEMBER_ROLE_CHANGED: "Droits modifiés",
                            SHOP_MEMBER_REVOKED: "Accès révoqué",
                            SHOP_INVITATION_REVOKED: "Invitation révoquée",
                          } as Record<string, string>
                        )[event.kind] || "Accès mis à jour"}
                      </Text>
                      <Text style={S.small}>
                        {date(event.at, true)} ·{" "}
                        {event.actorId === team.owner.id
                          ? team.owner.name
                          : team.members.find(
                              (m) => m.accountId === event.actorId,
                            )?.name || "Compte du magasin"}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : (
            <Text style={S.muted}>
              Le propriétaire et les responsables gèrent les accès à ce magasin.
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}

export const teamInvitationToken = (value: string) =>
  value.match(/#team-invite=([a-f0-9]{64})(?:$|&)/i)?.[1] || null;
export function AcceptShopInvitation({
  token,
  onJoined,
  onCancel,
}: {
  token: string;
  onJoined: (session: Session) => Promise<void>;
  onCancel: () => void;
}) {
  const [info, setInfo] = useState<{
      shop: string;
      email: string;
      role: Role;
      expiresAt: string;
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState("");
  const pending = useRef(false);
  async function preview() {
    setError("");
    try {
      setInfo(await post("/auth/shop-invitation/preview", { token }));
    } catch (e: any) {
      setError(e.message);
    }
  }
  useEffect(() => {
    preview();
  }, [token]);
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.white }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingVertical: 40,
          justifyContent: "center",
        }}
      >
        <View
          style={{ maxWidth: 420, width: "100%", alignSelf: "center", gap: 20 }}
        >
          <Logo />
          <View style={{ gap: 10, marginTop: 12 }}>
            <Text style={S.heading}>Votre place dans l’équipe.</Text>
            <Text style={S.muted}>
              Rejoignez le magasin avec votre propre compte.
            </Text>
          </View>
          {error && !info ? <Notice error>{error}</Notice> : null}
          {info ? (
            <>
              <View style={T.summary}>
                <Text style={T.title}>{info.shop}</Text>
                <Text style={[S.label, { color: C.green }]}>
                  {shopRoleNames[info.role]}
                </Text>
                <Text style={S.muted}>{roleDetails[info.role]}</Text>
                <Text style={S.small}>
                  Invitation valable jusqu’au {date(info.expiresAt, true)}
                </Text>
              </View>
              <Field
                label="Votre e-mail personnel"
                value={info.email}
                editable={false}
              />
              <Field
                label="Votre nom"
                value={name}
                onChangeText={setName}
                editable={!busy}
                autoComplete="name"
              />
              <Field
                label="Votre téléphone"
                value={phone}
                onChangeText={setPhone}
                editable={!busy}
                keyboardType="phone-pad"
                autoComplete="tel"
              />
              <Field
                label="Votre mot de passe"
                value={password}
                onChangeText={setPassword}
                editable={!busy}
                secureTextEntry
                autoComplete="new-password"
              />
              <Text style={S.small}>
                De 12 à 128 caractères. Le propriétaire ne connaît pas votre mot
                de passe.
              </Text>
              <Field
                label="Confirmer le mot de passe"
                value={confirmation}
                onChangeText={setConfirmation}
                editable={!busy}
                secureTextEntry
                autoComplete="new-password"
              />
              {confirmation && password !== confirmation ? (
                <Text style={[S.small, { color: C.red }]}>
                  Les deux mots de passe doivent être identiques.
                </Text>
              ) : null}
              {error ? <Notice error>{error}</Notice> : null}
              <Button
                variant="ink"
                loading={busy}
                disabled={
                  !name.trim() ||
                  !phone.trim() ||
                  password.length < 12 ||
                  password.length > 128 ||
                  password !== confirmation
                }
                onPress={async () => {
                  if (pending.current) return;
                  pending.current = true;
                  setBusy(true);
                  setError("");
                  try {
                    const next = await post<Session>(
                      "/auth/shop-invitation/accept",
                      { token, name, phone, password },
                    );
                    setPassword("");
                    setConfirmation("");
                    await onJoined(next);
                  } catch (e: any) {
                    setError(e.message);
                  } finally {
                    pending.current = false;
                    setBusy(false);
                  }
                }}
              >
                Rejoindre le magasin
              </Button>
              <Text style={S.small}>
                Votre panier reste personnel. Les commandes du magasin sont
                partagées selon vos droits. Le propriétaire peut révoquer cet
                accès.
              </Text>
            </>
          ) : !error ? (
            <Text style={S.muted}>Vérification du lien privé…</Text>
          ) : (
            <Button variant="secondary" onPress={preview}>
              Vérifier à nouveau le lien
            </Button>
          )}
          <Button variant="ghost" disabled={busy} onPress={onCancel}>
            Retour à la connexion
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const T = StyleSheet.create({
  wrap: { paddingTop: 16, paddingBottom: 24, gap: 24 },
  title: {
    fontFamily: "Inter",
    fontSize: 22,
    fontWeight: "700",
    lineHeight: 30,
    color: C.ink,
  },
  section: {
    fontFamily: "Inter",
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 25,
    color: C.ink,
  },
  person: {
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderColor: C.border,
    gap: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: C.pale,
    justifyContent: "center",
    alignItems: "center",
  },
  role: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12,
    borderRadius: 12,
    minHeight: 72,
  },
  edit: { paddingTop: 16, gap: 14 },
  form: { gap: 16, paddingVertical: 4 },
  link: { backgroundColor: C.pale, padding: 18, borderRadius: 12, gap: 12 },
  summary: { backgroundColor: C.bg, padding: 20, borderRadius: 16, gap: 10 },
});
