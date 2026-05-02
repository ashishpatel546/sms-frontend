# Provisions SSM parameters for sms-frontend development environment
# Path: /sms-frontend/development/
# Run once to set up or update values.

$prefix = "/sms-frontend/development"
$region = "ap-south-1"

$params = @(
  @{ Name = "API_URL";          Value = "https://sms-dev-api.colegios.in"; Type = "String" }
  @{ Name = "VAPID_PUBLIC_KEY"; Value = "BMhlf4viz8DfQzPjZUcXhm-EL1pc1TCamQAmqPbXN_6pElqFfDm3EnPyLHzyNf5SL4V_a656KpUSpmHqHSCg5g8"; Type = "String" }
)

$ok = 0
$fail = 0

foreach ($p in $params) {
  $fullName = "$prefix/$($p.Name)"
  try {
    aws ssm put-parameter --name $fullName --value $p.Value --type $p.Type --overwrite --region $region | Out-Null
    Write-Host "  [OK] $fullName"
    $ok++
  } catch {
    Write-Host "  [FAIL] $fullName — $_"
    $fail++
  }
}

Write-Host ""
Write-Host "Done. $ok succeeded, $fail failed."
Write-Host "Total params in $prefix/:"
aws ssm get-parameters-by-path --path "$prefix/" --region $region --query "length(Parameters)" --output text
