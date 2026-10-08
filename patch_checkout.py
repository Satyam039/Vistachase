import re

with open('frontend/src/components/booking/BookingCheckoutClient.tsx', 'r') as f:
    content = f.read()

# Add states for promo code
state_hook = """  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; percent: number; amount: number } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [isApplyingPromo, setIsApplyingPromo] = useState(false);

  const handleApplyPromo = async () => {
    setPromoError("");
    setIsApplyingPromo(true);
    try {
      const res = await fetch("/api/pricing/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ departureId: departure.id, adultsCount: adults, childrenCount: children, promoCode: promoCodeInput.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPromoError(data.error || "Invalid promo code");
        setAppliedPromo(null);
      } else {
        setAppliedPromo({ code: data.promoCode, percent: data.discountPercent, amount: data.discountAmount });
        setPromoCodeInput("");
      }
    } catch {
      setPromoError("Network error. Please try again.");
    } finally {
      setIsApplyingPromo(false);
    }
  };
"""

content = content.replace('  const [submitError, setSubmitError] = useState("");', '  const [submitError, setSubmitError] = useState("");\n' + state_hook)

# Modify totals calculation
totals_calc = """  const fareSubtotal = isVehicle
    ? departure.price
    : departure.price * totalSeats;
  const addOnsTotal = selectedAddOns.reduce(
    (sum, addOn) => sum + addOn.total,
    0,
  );
  const discount = appliedPromo ? Math.round(fareSubtotal * (appliedPromo.percent / 100)) : 0;
  const tax = round2((fareSubtotal - discount + addOnsTotal) * GST_RATE);
  const total = round2(fareSubtotal - discount + addOnsTotal + tax);
"""

content = re.sub(r'  const fareSubtotal = isVehicle[\s\S]*?const total = round2\(fareSubtotal \+ addOnsTotal \+ tax\);', totals_calc.strip(), content)

# Inject Promo Box in Step 3
promo_ui = """                          <Card padding={4}>
                            <VStack gap={3}>
                              <HStack vAlign="end" gap={2}>
                                <StackItem size="fill">
                                  <TextInput
                                    label="Promo code"
                                    isOptional
                                    value={promoCodeInput}
                                    onChange={setPromoCodeInput}
                                    placeholder="Enter code"
                                    disabled={isApplyingPromo}
                                  />
                                </StackItem>
                                <Button
                                  variant="secondary"
                                  label={isApplyingPromo ? "Applying..." : "Apply"}
                                  onClick={handleApplyPromo}
                                  disabled={!promoCodeInput.trim() || isApplyingPromo}
                                />
                              </HStack>
                              {promoError && <p className="text-sm text-red-600">{promoError}</p>}
                              {appliedPromo && (
                                <HStack hAlign="between" className="text-sm text-ocean-600 font-medium">
                                  <span>Applied: {appliedPromo.code} (-{appliedPromo.percent}%)</span>
                                  <button onClick={() => setAppliedPromo(null)} className="underline hover:text-ocean-700">Remove</button>
                                </HStack>
                              )}
                            </VStack>
                          </Card>
"""

content = content.replace('                          <Banner\n                            status="info"', promo_ui + '\n                          <Banner\n                            status="info"')

# Update completeBooking payload
content = content.replace('          paymentProvider: "mock",', '          paymentProvider: "mock",\n          promoCode: appliedPromo?.code,')

with open('frontend/src/components/booking/BookingCheckoutClient.tsx', 'w') as f:
    f.write(content)

