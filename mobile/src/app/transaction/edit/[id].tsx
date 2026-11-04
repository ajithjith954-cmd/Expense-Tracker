import { useLocalSearchParams } from "expo-router";

import { EditScreen } from "@/features/transactions/edit-screen";

export default function EditTransactionRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditScreen id={id ?? ""} />;
}
