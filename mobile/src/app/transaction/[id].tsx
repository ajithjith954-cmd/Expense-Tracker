import { useLocalSearchParams } from "expo-router";

import { DetailScreen } from "@/features/transactions/detail-screen";

export default function TransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DetailScreen id={id ?? ""} />;
}
