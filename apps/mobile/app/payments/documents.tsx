import { Linking, StyleSheet, View } from "react-native";
import { DOCUMENT_LABELS, type DocumentRef } from "@proj/shared";
import { ExternalLink, FileText, Receipt, Landmark, FileBarChart } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useTheme } from "../../src/theme/ThemeProvider";
import { radius, space, withAlpha } from "../../src/theme/tokens";
import { API_BASE_URL, api } from "../../src/api/client";
import { messageOf, useAsync } from "../../src/lib/useAsync";
import { formatDate } from "../../src/lib/format";
import { AppHeader } from "../../src/components/AppHeader";
import { Card } from "../../src/components/Card";
import { EmptyState } from "../../src/components/EmptyState";
import { Screen } from "../../src/components/Screen";
import { ErrorState, Loading } from "../../src/components/States";
import { Text } from "../../src/components/Text";
import { useToast } from "../../src/components/Toast";

const ICONS: Record<DocumentRef["kind"], LucideIcon> = {
  invoice: FileText,
  receipt: Receipt,
  hra: Landmark,
  ledger: FileBarChart,
};

export default function DocumentsScreen() {
  const { c } = useTheme();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(() => api.documents(), []);

  const open = async (doc: DocumentRef) => {
    try {
      // The browser can't send a bearer token, so the server mints a
      // short-lived signed URL for this one document.
      const { url } = await api.documentUrl(doc.kind, doc.id);
      await Linking.openURL(`${API_BASE_URL}${url}`);
    } catch (err) {
      toast.error(messageOf(err));
    }
  };

  return (
    <>
      <AppHeader title="Documents" />
      <Screen refreshing={loading} onRefresh={() => void reload()}>
        {loading && !data ? (
          <Loading />
        ) : error || !data ? (
          <ErrorState
            message={error ?? "Couldn't load your documents."}
            onRetry={() => void reload()}
          />
        ) : data.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nothing to download yet"
            description="Invoices, rent receipts and your HRA statement appear here as they're generated."
          />
        ) : (
          <>
            <Text variant="body" tone="muted">
              Each opens in your browser, where you can save it as a PDF.
            </Text>

            {data.map((doc) => {
              const Icon = ICONS[doc.kind];
              return (
                <Card
                  key={`${doc.kind}-${doc.id}`}
                  accessibilityLabel={doc.title}
                  onPress={() => void open(doc)}
                >
                  <View style={styles.row}>
                    <View
                      style={[
                        styles.chip,
                        { backgroundColor: withAlpha(c.accent, 0.12) },
                      ]}
                    >
                      <Icon size={20} color={c.accentStrong} strokeWidth={2} />
                    </View>
                    <View style={styles.body}>
                      <Text variant="cardTitle">{doc.title}</Text>
                      <Text variant="label" tone="muted">
                        {DOCUMENT_LABELS[doc.kind]} · {doc.subtitle}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {formatDate(doc.issuedAt)}
                      </Text>
                    </View>
                    <ExternalLink size={18} color={c.muted} strokeWidth={2} />
                  </View>
                </Card>
              );
            })}
          </>
        )}
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  chip: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 2 },
});
