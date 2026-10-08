import re

with open('backend/scripts/finance-export.ts', 'r') as f:
    content = f.read()

logic = """
  // Payout Export for Affiliates
  const affiliates = await prisma.affiliate.findMany({
    include: { user: true, _count: { select: { referrals: true } } }
  });
  
  let payoutCsv = "PartnerName,Email,CommissionRate,ReferralCount,TotalCommissionDue\n";
  for (const aff of affiliates) {
    // Basic calculation for demo: each referral = assumed $15 commission
    const commissionDue = aff._count.referrals * 15.00;
    payoutCsv += `${aff.user.name},${aff.user.email},${aff.commissionRate}%,${aff._count.referrals},${commissionDue.toFixed(2)}\n`;
  }
  
  const payoutFilename = `payout_export_${Date.now()}.csv`;
  fs.writeFileSync(payoutFilename, payoutCsv);
  console.log(`Partner payout export saved to ${payoutFilename}`);
"""

content = content.replace('  console.log(`Export saved to ${filename}`);', '  console.log(`Export saved to ${filename}`);\n' + logic.strip())

with open('backend/scripts/finance-export.ts', 'w') as f:
    f.write(content)
