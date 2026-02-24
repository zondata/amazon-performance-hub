export function rejectDeprecatedAccountId(accountId: string) {
  const v = (accountId ?? "").trim().toLowerCase();
  if (v === "us") {
    throw new Error(
      "Invalid --account-id: 'US' is deprecated. Use 'sourbear' instead."
    );
  }
}
