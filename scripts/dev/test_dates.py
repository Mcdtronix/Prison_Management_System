from datetime import date, timedelta
from dateutil.relativedelta import relativedelta

dos = date(2026, 8, 13)
raw_odr = dos + relativedelta(years=8)
print("Raw ODR (DOS + 8 years):", raw_odr)

days_diff = (raw_odr - dos).days
print("Days difference (raw_odr - dos):", days_diff)

print("Target ODR:", date(2034, 8, 12))
print("Target EDR:", date(2031, 12, 12))

print("2921 days after DOS:", dos + timedelta(days=2921))
print("1948 days after DOS:", dos + timedelta(days=1948))
print("1947 days after DOS:", dos + timedelta(days=1947))
