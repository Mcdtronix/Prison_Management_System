# PMS Test Admissions: 20 Inmates

Test data for entering new admissions on the server through **Inmates → New Admission** (Reception account), followed by **offence registration**. Each inmate covers a sentencing scenario, and each record lists the release dates PMS should calculate, so you can check the system after entry.

|  |  |
|---|---|
| **Prepared** | 7 November 2026 |
| **Station** | Chivhu Prison (adjust courts and home areas for other stations) |
| **Prison numbers** | 0101/26 to 0120/26. If any are already used on the server, use your next free numbers and keep the same order. |
| **Expected results** | Calculated by running these exact records through the PMS sentencing code (current version). Valid when entered with the dates shown. |
| **Data** | Fictional. Names, ID numbers and phone numbers do not belong to real people. |

---

## 1. Summary

| # | Prison No. | Name | Group | Counts | Restitution | Total sentence | EDR | ODR | Class |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 0101/26 | Tendai Mapfumo | A | 1 unconvicted | – | Remand | – | – | D |
| 2 | 0102/26 | Chipo Mushonga | A | 1 unconvicted | – | Remand | – | – | D |
| 3 | 0103/26 | Blessing Nyathi | A | 1 unconvicted | – | Remand | – | – | D |
| 4 | 0104/26 | Joao Macuacua | A | 1 unconvicted | – | Remand | – | – | D |
| 5 | 0105/26 | Simbarashe Gumbo | B | 1 convicted | – | 6 months | 02/03/2027 | 01/05/2027 | A |
| 6 | 0106/26 | Rudo Chikwanha | B | 1 convicted | – | 60 months | 04/03/2030 | 02/11/2031 | C |
| 7 | 0107/26 | Tafadzwa Dube | B | 1 convicted | – | 120 months | 05/07/2033 | 03/11/2036 | C |
| 8 | 0108/26 | Peter Ndlovu | B | 1 convicted | – | 3 months | 06/01/2027 | 05/02/2027 | A |
| 9 | 0109/26 | Kudakwashe Mlambo | C | 2 convicted | Yes | 36 months | 01/11/2028 | 01/11/2029 | B |
| 10 | 0110/26 | Nyasha Zvobgo | C | 3 convicted | Yes | 42 months | 03/03/2029 | 02/05/2030 | C |
| 11 | 0111/26 | Brian Moyo | C | 2 convicted | Yes | 108 months | 04/11/2032 | 04/11/2035 | D |
| 12 | 0112/26 | Takudzwa Sibanda | D | 2 unconvicted | – | Remand | – | – | D |
| 13 | 0113/26 | Memory Banda | D | 2 unconvicted | – | Remand | – | – | D |
| 14 | 0114/26 | Wellington Chari | E | 1 convicted, 1 unconvicted | Yes | 12 months | 03/07/2027 | 01/11/2027 | D |
| 15 | 0115/26 | Grace Mutasa | E | 1 convicted, 1 unconvicted | – | 18 months | 03/11/2027 | 03/05/2028 | D |
| 16 | 0116/26 | Prosper Mhlanga | E | 2 convicted, 1 unconvicted | Yes | 18 months | 04/11/2027 | 04/05/2028 | D |
| 17 | 0117/26 | Lloyd Marufu | E | 2 convicted, 1 unconvicted | – | 24 months | 07/03/2028 | 05/11/2028 | D |
| 18 | 0118/26 | Edmore Kanengoni | F | 4 convicted | Yes | 78 months | 02/03/2031 | 01/05/2033 | C |
| 19 | 0119/26 | Fadzai Matanda | F | 3 convicted | Yes | 48 months | 03/07/2029 | 02/11/2030 | C |
| 20 | 0120/26 | Sipho Ncube | F | 2 convicted | – | 30 months | 03/07/2028 | 03/05/2029 | B |

**Scenario groups**

| Group | Scenario | Inmates |
|---|---|---|
| A | One unconvicted offence | 0101/26, 0102/26, 0103/26, 0104/26 |
| B | One convicted offence | 0105/26, 0106/26, 0107/26, 0108/26 |
| C | More than one convicted offence, some with restitution | 0109/26, 0110/26, 0111/26 |
| D | More than one unconvicted offence | 0112/26, 0113/26 |
| E | Mixed convicted and unconvicted, with and without restitution | 0114/26, 0115/26, 0116/26, 0117/26 |
| F | Total sentence: concurrent and consecutive counts with restitution | 0118/26, 0119/26, 0120/26 |

EDR = earliest date of release (with remission). ODR = official date of release (full sentence). Where restitution applies, the dates in this table assume it is **not yet paid**; the record shows the dates once it is paid.

---

## 2. How to Enter Each Inmate

1. **Inmates → New Admission.** Complete Sections 1–5 from the inmate's record below and click **Save**.
2. **Offence registration** opens next. Add each count in the order listed, so *Count 1* is the first offence entered.
   - **Unconvicted:** status *Unconvicted*, remand start date, next court date and, if listed, tick **Bail** and enter the amount.
   - **Convicted:** status *Convicted*, sentence (years / months / days) and date of sentence. Tick **Fine** and enter the amount where a fine option is listed.
   - **Concurrent with:** where a count shows *Concurrent with Count 1*, choose Count 1 in that field. Leave it empty for consecutive counts.
   - **Restitution:** tick **Restitution** on the count, then fill amount, due date and the part of the sentence remitted if paid. Status stays *Pending*.
3. Before saving, compare the **release preview** with *Expected results*. After saving, open the inmate details and check the same figures.
4. The inmate then waits for the Health admission assessment and Administration approval.

**Sentencing rules applied** (how the expected results were reached):

- The date of sentence is day one. Months and years are counted on the calendar.
- Remission = one third of the total days, rounded down.
- ODR = date of sentence + total days − 1. EDR = date of sentence + (total days − remission) − 1.
- Concurrent counts count once, at the longest. Consecutive counts are added.
- Restitution: the remitted part is taken off the total only when the restitution is **paid with a receipt**. Remitted months count as 30 days, years as 365.
- Class: any unconvicted count → D. Otherwise by time to serve after remission: 84+ months D, 36–83 C, 18–35 B, under 18 A.

---

## 3. Inmate Records

### 3.1 0101/26 · Tendai Kudzai Mapfumo

> **Group A: One unconvicted offence.** One unconvicted offence, no bail.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0101/26 |
| **CRB Number** | CRB 211/11/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 03/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Tendai | **Surname** | Mapfumo |
| **Other Names** | Kudzai | **Gender** | Male |
| **Date of Birth** | 12/05/1994 | **Nationality** | Zimbabwean |
| **National ID** | 63-2148573 K 22 | **Marital Status** | Married |
| **Educational Level** | Ordinary Level | **Race** | African |
| **Residential Address** | Stand 412, Mushandirapamwe, Chivhu | **Occupation** | Farm labourer |
| **Father's Name** | Joseph Mapfumo | **District** | Chikomba |
| **Chief** | Chief Nyashanu | **Headman** | Mutasa |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Rumbidzai Mapfumo | **Relationship** | Wife |
| **Address** | Stand 412, Mushandirapamwe, Chivhu | **Contact Number** | 0771 000 101 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0101 |
| **Cash held** | USD 12.00 · ZWG 150.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Trousers (Blue) · T-shirts (White) · Shoes (Black) · Cap (Red) |
| **Other property** | Mobile phone (Itel, black), national ID card |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Stock Theft (1 head of cattle) | Chivhu Magistrates Court | Unconvicted | – | Remand from 03/11/2026; next court 17/11/2026 | – | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Release dates | None while on remand |
| Next court date(s) | 17/11/2026 (shown on the Courts calendar) |
| Calculated class | D |
| Record Court Session | Available (court matter pending) |

---

### 3.2 0102/26 · Chipo Mushonga

> **Group A: One unconvicted offence.** One unconvicted offence, bail granted.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0102/26 |
| **CRB Number** | CRB 214/11/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 04/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Chipo | **Surname** | Mushonga |
| **Other Names** | – | **Gender** | Female |
| **Date of Birth** | 30/09/1998 | **Nationality** | Zimbabwean |
| **National ID** | 63-3021457 F 63 | **Marital Status** | Single |
| **Educational Level** | Advanced Level | **Race** | African |
| **Residential Address** | House 27, Old Location, Chivhu | **Occupation** | Vendor |
| **Father's Name** | Tichaona Mushonga | **District** | Chikomba |
| **Chief** | Chief Mutekedza | **Headman** | Chipunza |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Esther Mushonga | **Relationship** | Mother |
| **Address** | House 27, Old Location, Chivhu | **Contact Number** | 0772 000 102 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0102 |
| **Cash held** | USD 35.00 |
| **Clothing (tick, then colour)** | Dress (Green) · Shoes (Brown) · Jersey (Grey) |
| **Other property** | Handbag (brown), earrings (silver) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Assault | Chivhu Magistrates Court | Unconvicted | – | Remand from 04/11/2026; next court 20/11/2026 | – | USD 50.00 | – |

**Expected results**

| Check | Expected |
|---|---|
| Release dates | None while on remand |
| Next court date(s) | 20/11/2026 (shown on the Courts calendar) |
| Calculated class | D |
| Record Court Session | Available (court matter pending) |

---

### 3.3 0103/26 · Blessing Sipho Nyathi

> **Group A: One unconvicted offence.** One unconvicted offence (drugs), no bail.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0103/26 |
| **CRB Number** | CRB 220/11/26 | **First-time offender** | No (untick) |
| **Admission date** | 05/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Blessing | **Surname** | Nyathi |
| **Other Names** | Sipho | **Gender** | Male |
| **Date of Birth** | 18/01/1990 | **Nationality** | Zimbabwean |
| **National ID** | 08-1456320 B 08 | **Marital Status** | Divorced |
| **Educational Level** | Primary | **Race** | African |
| **Residential Address** | No. 9 Mkoba 12, Gweru | **Occupation** | Unemployed |
| **Father's Name** | Themba Nyathi | **District** | Gweru |
| **Chief** | Chief Gwesela | **Headman** | Ncube |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Sithembile Nyathi | **Relationship** | Sister |
| **Address** | No. 9 Mkoba 12, Gweru | **Contact Number** | 0773 000 103 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0103 |
| **Cash held** | None |
| **Clothing (tick, then colour)** | Shorts (Black) · T-shirts (Red) · Socks (White) · Shoes (White) |
| **Other property** | None |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Possession of Dangerous Drugs (cannabis) | Gweru Regional Court | Unconvicted | – | Remand from 05/11/2026; next court 24/11/2026 | – | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Release dates | None while on remand |
| Next court date(s) | 24/11/2026 (shown on the Courts calendar) |
| Calculated class | D |
| Record Court Session | Available (court matter pending) |

---

### 3.4 0104/26 · Joao Armando Macuacua

> **Group A: One unconvicted offence.** One unconvicted offence, foreign national.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0104/26 |
| **CRB Number** | CRB 223/11/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 06/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Joao | **Surname** | Macuacua |
| **Other Names** | Armando | **Gender** | Male |
| **Date of Birth** | 04/07/1996 | **Nationality** | Mozambican |
| **National ID** | Leave blank (foreign national) | **Marital Status** | Single |
| **Educational Level** | Primary | **Race** | African |
| **Residential Address** | Bairro 25 de Setembro, Manica, Mozambique | **Occupation** | Cross-border trader |
| **Father's Name** | Armando Macuacua | **District** | Mutare |
| **Chief** | – | **Headman** |  |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Ana Macuacua | **Relationship** | Mother |
| **Address** | Bairro 25 de Setembro, Manica, Mozambique | **Contact Number** | +258 84 000 0104 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0104 |
| **Cash held** | USD 40.00 · ZAR 350.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Trousers (Black) · T-shirts (Blue) · Shoes (Brown) · Wallet (Black) |
| **Other property** | Mozambican passport (held by Immigration), bag of clothes |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Contravening Immigration Act (illegal entry) | Mutare Magistrates Court | Unconvicted | – | Remand from 06/11/2026; next court 19/11/2026 | – | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Release dates | None while on remand |
| Next court date(s) | 19/11/2026 (shown on the Courts calendar) |
| Calculated class | D |
| Record Court Session | Available (court matter pending) |

---

### 3.5 0105/26 · Simbarashe Gumbo

> **Group B: One convicted offence.** One convicted offence, short sentence (class A).

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0105/26 |
| **CRB Number** | CRB 198/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 02/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Simbarashe | **Surname** | Gumbo |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 22/03/2001 | **Nationality** | Zimbabwean |
| **National ID** | 63-4102938 S 63 | **Marital Status** | Single |
| **Educational Level** | Ordinary Level | **Race** | African |
| **Residential Address** | Plot 6, Sadza Growth Point, Chikomba | **Occupation** | General hand |
| **Father's Name** | Peter Gumbo | **District** | Chikomba |
| **Chief** | Chief Neshangwe | **Headman** | Sadza |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Peter Gumbo | **Relationship** | Father |
| **Address** | Plot 6, Sadza Growth Point, Chikomba | **Contact Number** | 0774 000 105 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0105 |
| **Cash held** | ZWG 220.00 |
| **Clothing (tick, then colour)** | Trousers (Grey) · Jersey (Blue) · Shoes (Black) |
| **Other property** | Watch (Casio, black) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Theft | Chivhu Magistrates Court | Convicted | 6 months | Sentenced 02/11/2026 | – (consecutive) | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 6 months |
| Total sentence | 6 months = **181 days** from 02/11/2026 |
| Remission | 181 ÷ 3 = **60 days** |
| EDR | **02/03/2027** |
| ODR | **01/05/2027** |
| Calculated class | A |

---

### 3.6 0106/26 · Rudo Tariro Chikwanha

> **Group B: One convicted offence.** One convicted offence, medium sentence (class C).

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0106/26 |
| **CRB Number** | CRB 176/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 03/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Rudo | **Surname** | Chikwanha |
| **Other Names** | Tariro | **Gender** | Female |
| **Date of Birth** | 02/12/1987 | **Nationality** | Zimbabwean |
| **National ID** | 22-1035874 R 22 | **Marital Status** | Widowed |
| **Educational Level** | Tertiary Level | **Race** | African |
| **Residential Address** | 45 Hobhouse, Mutare | **Occupation** | Driver |
| **Father's Name** | Samuel Chikwanha | **District** | Mutare |
| **Chief** | Chief Zimunya | **Headman** | Dzobo |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Tinashe Chikwanha | **Relationship** | Son |
| **Address** | 45 Hobhouse, Mutare | **Contact Number** | 0775 000 106 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0106 |
| **Cash held** | USD 60.00 · ZWG 500.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Blouse (White) · Skirt (Black) · Shoes (Black) |
| **Other property** | Driver's licence, car keys (Toyota) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Culpable Homicide (road accident) | Masvingo Regional Court | Convicted | 5 years | Sentenced 03/11/2026 | – (consecutive) | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 60 months |
| Total sentence | 60 months (5 years) = **1,826 days** from 03/11/2026 |
| Remission | 1,826 ÷ 3 = **608 days** |
| EDR | **04/03/2030** |
| ODR | **02/11/2031** |
| Calculated class | C |

---

### 3.7 0107/26 · Tafadzwa Dube

> **Group B: One convicted offence.** One convicted offence, long sentence (class D).

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0107/26 |
| **CRB Number** | CRB 160/10/26 | **First-time offender** | No (untick) |
| **Admission date** | 04/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Tafadzwa | **Surname** | Dube |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 15/08/1992 | **Nationality** | Zimbabwean |
| **National ID** | 58-2290413 T 58 | **Marital Status** | Married |
| **Educational Level** | Ordinary Level | **Race** | African |
| **Residential Address** | 1123 Mucheke, Masvingo | **Occupation** | Welder |
| **Father's Name** | Clever Dube | **District** | Masvingo |
| **Chief** | Chief Murinye | **Headman** | Shumba |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Patience Dube | **Relationship** | Wife |
| **Address** | 1123 Mucheke, Masvingo | **Contact Number** | 0776 000 107 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0107 |
| **Cash held** | USD 5.00 |
| **Clothing (tick, then colour)** | Trousers (Brown) · T-shirts (Black) · Shoes (Brown) · Cap (Black) |
| **Other property** | Silver chain |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Robbery | High Court of Zimbabwe (Masvingo) | Convicted | 10 years | Sentenced 04/11/2026 | – (consecutive) | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 120 months |
| Total sentence | 120 months (10 years) = **3,653 days** from 04/11/2026 |
| Remission | 3,653 ÷ 3 = **1,217 days** |
| EDR | **05/07/2033** |
| ODR | **03/11/2036** |
| Calculated class | C |

---

### 3.8 0108/26 · Peter Mandla Ndlovu

> **Group B: One convicted offence.** One convicted offence with fine option.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0108/26 |
| **CRB Number** | CRB 226/11/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 06/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Peter | **Surname** | Ndlovu |
| **Other Names** | Mandla | **Gender** | Male |
| **Date of Birth** | 09/04/1985 | **Nationality** | Zimbabwean |
| **National ID** | 63-0987654 P 63 | **Marital Status** | Married |
| **Educational Level** | Advanced Level | **Race** | African |
| **Residential Address** | 12 Hospital Road, Chivhu | **Occupation** | Mechanic |
| **Father's Name** | Mandla Ndlovu | **District** | Chikomba |
| **Chief** | Chief Nyashanu | **Headman** | Gumbo |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Linda Ndlovu | **Relationship** | Wife |
| **Address** | 12 Hospital Road, Chivhu | **Contact Number** | 0777 000 108 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0108 |
| **Cash held** | USD 20.00 · ZAR 200.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Trousers (Blue) · Jersey (Black) · Shoes (Black) · Socks (Black) |
| **Other property** | Mobile phone (Samsung, blue) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Driving without a licence | Chivhu Magistrates Court | Convicted | 3 months | Sentenced 06/11/2026 | – (consecutive) | – | USD 100.00 |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 3 months |
| Total sentence | 3 months = **92 days** from 06/11/2026 |
| Remission | 92 ÷ 3 = **30 days** |
| EDR | **06/01/2027** |
| ODR | **05/02/2027** |
| Fine option | If the fine is paid, discharge that count with reason *Fine* |
| Calculated class | A |

---

### 3.9 0109/26 · Kudakwashe Mlambo

> **Group C: More than one convicted offence, some with restitution.** Two convicted counts, consecutive; restitution on Count 1.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0109/26 |
| **CRB Number** | CRB 150/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 02/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Kudakwashe | **Surname** | Mlambo |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 11/11/1989 | **Nationality** | Zimbabwean |
| **National ID** | 63-1593574 K 63 | **Marital Status** | Married |
| **Educational Level** | Tertiary Level | **Race** | African |
| **Residential Address** | 7 Lancaster Road, Chivhu | **Occupation** | Accounts clerk |
| **Father's Name** | Edson Mlambo | **District** | Chikomba |
| **Chief** | Chief Mutekedza | **Headman** | Mlambo |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Faith Mlambo | **Relationship** | Wife |
| **Address** | 7 Lancaster Road, Chivhu | **Contact Number** | 0778 000 109 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0109 |
| **Cash held** | USD 150.00 · ZWG 1000.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Trousers (Black) · T-shirts (White) · Shoes (Black) · Wallet (Brown) |
| **Other property** | Laptop bag (empty), bank card |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Theft of Trust Property | Masvingo Regional Court | Convicted | 2 years | Sentenced 02/11/2026 | – (consecutive) | – | – |
| 2 | Count 2 - Forgery | Masvingo Regional Court | Convicted | 1 year | Sentenced 02/11/2026 | – (consecutive) | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 1 | USD 2,500.00 | 15/12/2026 | 6 months | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 24 months; Count 2: 12 months = **36 months** |
| Total sentence | 36 months (3 years) = **1,096 days** from 02/11/2026 |
| Remission | 1,096 ÷ 3 = **365 days** |
| EDR | **01/11/2028** |
| ODR | **01/11/2029** |
| If restitution paid | 1,096 − 180 remitted = 916 days; remission 305 |
| EDR / ODR if paid | **04/07/2028** / **05/05/2029** |
| Calculated class | B |

---

### 3.10 0110/26 · Nyasha Rutendo Zvobgo

> **Group C: More than one convicted offence, some with restitution.** Three convicted counts: 1 and 2 concurrent, 3 consecutive; restitution on Count 1.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0110/26 |
| **CRB Number** | CRB 141/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 03/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Nyasha | **Surname** | Zvobgo |
| **Other Names** | Rutendo | **Gender** | Female |
| **Date of Birth** | 27/02/1984 | **Nationality** | Zimbabwean |
| **National ID** | 63-2468013 N 63 | **Marital Status** | Divorced |
| **Educational Level** | Tertiary Level | **Race** | African |
| **Residential Address** | 19 Coronation Avenue, Chivhu | **Occupation** | Bookkeeper |
| **Father's Name** | George Zvobgo | **District** | Chikomba |
| **Chief** | Chief Nyashanu | **Headman** | Zvobgo |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Hope Zvobgo | **Relationship** | Daughter |
| **Address** | 19 Coronation Avenue, Chivhu | **Contact Number** | 0779 000 110 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0110 |
| **Cash held** | USD 80.00 · BWP 300.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Dress (Blue) · Jersey (White) · Shoes (Black) |
| **Other property** | Handbag (black), reading glasses |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Fraud | Gweru Regional Court | Convicted | 3 years | Sentenced 03/11/2026 | – | – | – |
| 2 | Count 2 - Uttering a Forged Document | Gweru Regional Court | Convicted | 18 months | Sentenced 03/11/2026 | Count 1 | – | – |
| 3 | Count 3 - Theft | Gweru Regional Court | Convicted | 6 months | Sentenced 03/11/2026 | – (consecutive) | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 1 | USD 5,000.00 | 31/01/2027 | 1 year | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Counts 1 ∥ 2 concurrent → 36 months (longest); Count 3: 6 months = **42 months** |
| Total sentence | 42 months (3 years 6 months) = **1,277 days** from 03/11/2026 |
| Remission | 1,277 ÷ 3 = **425 days** |
| EDR | **03/03/2029** |
| ODR | **02/05/2030** |
| If restitution paid | 1,277 − 365 remitted = 912 days; remission 304 |
| EDR / ODR if paid | **02/07/2028** / **02/05/2029** |
| Calculated class | C |

---

### 3.11 0111/26 · Brian Moyo

> **Group C: More than one convicted offence, some with restitution.** Two convicted counts, concurrent; restitution on Count 1 (stock theft).

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0111/26 |
| **CRB Number** | CRB 132/10/26 | **First-time offender** | No (untick) |
| **Admission date** | 05/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Brian | **Surname** | Moyo |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 06/06/1979 | **Nationality** | Zimbabwean |
| **National ID** | 58-0765432 B 58 | **Marital Status** | Married |
| **Educational Level** | Primary | **Race** | African |
| **Residential Address** | Village 4, Ward 12, Chivi | **Occupation** | Subsistence farmer |
| **Father's Name** | Lameck Moyo | **District** | Chivi |
| **Chief** | Chief Shindi | **Headman** | Madzivire |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Mercy Moyo | **Relationship** | Wife |
| **Address** | Village 4, Ward 12, Chivi | **Contact Number** | 0712 000 111 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0111 |
| **Cash held** | ZWG 80.00 |
| **Clothing (tick, then colour)** | Trousers (Brown) · Jersey (Green) · Shoes (Brown) · Cap (Blue) |
| **Other property** | Knobkerrie (handed to police), blanket |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Stock Theft (2 cattle) | Masvingo Regional Court | Convicted | 9 years | Sentenced 05/11/2026 | – | – | – |
| 2 | Count 2 - Stock Theft (1 cattle) | Masvingo Regional Court | Convicted | 9 years | Sentenced 05/11/2026 | Count 1 | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 1 | USD 1,200.00 | 28/02/2027 | 2 years | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Counts 1 ∥ 2 concurrent → 108 months (longest) |
| Total sentence | 108 months (9 years) = **3,287 days** from 05/11/2026 |
| Remission | 3,287 ÷ 3 = **1,095 days** |
| EDR | **04/11/2032** |
| ODR | **04/11/2035** |
| If restitution paid | 3,287 − 730 remitted = 2,557 days; remission 852 |
| EDR / ODR if paid | **06/07/2031** / **04/11/2033** |
| Calculated class | D |

---

### 3.12 0112/26 · Takudzwa Leon Sibanda

> **Group D: More than one unconvicted offence.** Two unconvicted counts, no bail.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0112/26 |
| **CRB Number** | CRB 229/11/26 | **First-time offender** | No (untick) |
| **Admission date** | 06/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Takudzwa | **Surname** | Sibanda |
| **Other Names** | Leon | **Gender** | Male |
| **Date of Birth** | 21/10/1997 | **Nationality** | Zimbabwean |
| **National ID** | 63-3579135 T 63 | **Marital Status** | Single |
| **Educational Level** | Ordinary Level | **Race** | African |
| **Residential Address** | 88 Mbare Flats, Harare | **Occupation** | Taxi driver |
| **Father's Name** | Lovemore Sibanda | **District** | Harare |
| **Chief** | – | **Headman** |  |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Angela Sibanda | **Relationship** | Aunt |
| **Address** | 88 Mbare Flats, Harare | **Contact Number** | 0713 000 112 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0112 |
| **Cash held** | USD 210.00 |
| **Clothing (tick, then colour)** | Trousers (Black) · T-shirts (Black) · Shoes (White) · Cap (Black) |
| **Other property** | Two mobile phones (iPhone, black; Itel, blue), belt |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Armed Robbery | High Court of Zimbabwe (Masvingo) | Unconvicted | – | Remand from 06/11/2026; next court 25/11/2026 | – | – | – |
| 2 | Count 2 - Unlawful Possession of a Firearm | High Court of Zimbabwe (Masvingo) | Unconvicted | – | Remand from 06/11/2026; next court 25/11/2026 | – | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Release dates | None while on remand |
| Next court date(s) | 25/11/2026 (shown on the Courts calendar) |
| Calculated class | D |
| Record Court Session | Available (court matter pending) |

---

### 3.13 0113/26 · Memory Banda

> **Group D: More than one unconvicted offence.** Two unconvicted counts, bail on Count 1 only, foreign national.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0113/26 |
| **CRB Number** | CRB 231/11/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 07/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Memory | **Surname** | Banda |
| **Other Names** | – | **Gender** | Female |
| **Date of Birth** | 14/01/1993 | **Nationality** | Malawian |
| **National ID** | Leave blank (foreign national) | **Marital Status** | Married |
| **Educational Level** | Primary | **Race** | African |
| **Residential Address** | Lot 3, Chitungwiza Unit L, Harare | **Occupation** | Domestic worker |
| **Father's Name** | Yohane Banda | **District** | Seke |
| **Chief** | – | **Headman** |  |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Charles Banda | **Relationship** | Husband |
| **Address** | Lot 3, Chitungwiza Unit L, Harare | **Contact Number** | 0714 000 113 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0113 |
| **Cash held** | USD 15.00 · ZWG 300.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Skirt (Blue) · Blouse (Pink) · Shoes (Black) |
| **Other property** | Malawian passport, head scarf |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Theft | Chivhu Magistrates Court | Unconvicted | – | Remand from 07/11/2026; next court 21/11/2026 | – | USD 80.00 | – |
| 2 | Count 2 - Unlawful Entry | Chivhu Magistrates Court | Unconvicted | – | Remand from 07/11/2026; next court 03/12/2026 | – | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Release dates | None while on remand |
| Next court date(s) | 21/11/2026, 03/12/2026 (shown on the Courts calendar) |
| Calculated class | D |
| Record Court Session | Available (court matter pending) |

---

### 3.14 0114/26 · Wellington Chari

> **Group E: Mixed convicted and unconvicted, with and without restitution.** Mixed: Count 1 convicted with restitution; Count 2 unconvicted.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0114/26 |
| **CRB Number** | CRB 188/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 02/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Wellington | **Surname** | Chari |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 03/09/1991 | **Nationality** | Zimbabwean |
| **National ID** | 63-1112223 W 63 | **Marital Status** | Single |
| **Educational Level** | Ordinary Level | **Race** | African |
| **Residential Address** | 31 Chivhu Township | **Occupation** | Builder |
| **Father's Name** | Moses Chari | **District** | Chikomba |
| **Chief** | Chief Mutekedza | **Headman** | Chari |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Moses Chari | **Relationship** | Father |
| **Address** | 31 Chivhu Township | **Contact Number** | 0715 000 114 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0114 |
| **Cash held** | USD 25.00 |
| **Clothing (tick, then colour)** | Trousers (Grey) · Shorts (Blue) · T-shirts (Grey) · Shoes (Grey) |
| **Other property** | Builder's tools (trowel, level) handed to next of kin |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Theft | Chivhu Magistrates Court | Convicted | 1 year | Sentenced 02/11/2026 | – (consecutive) | – | – |
| 2 | Count 2 - Unlawful Entry | Chivhu Magistrates Court | Unconvicted | – | Remand from 02/11/2026; next court 26/11/2026 | – | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 1 | USD 600.00 | 04/12/2026 | 4 months | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 12 months |
| Total sentence | 12 months (1 year) = **365 days** from 02/11/2026 |
| Remission | 365 ÷ 3 = **121 days** |
| EDR | **03/07/2027** |
| ODR | **01/11/2027** |
| If restitution paid | 365 − 120 remitted = 245 days; remission 81 |
| EDR / ODR if paid | **14/04/2027** / **04/07/2027** |
| Unconvicted count(s) | Still before the court; next court 26/11/2026 |
| Calculated class | D |

---

### 3.15 0115/26 · Grace Chiedza Mutasa

> **Group E: Mixed convicted and unconvicted, with and without restitution.** Mixed: Count 1 convicted, no restitution; Count 2 unconvicted on bail.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0115/26 |
| **CRB Number** | CRB 170/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 04/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Grace | **Surname** | Mutasa |
| **Other Names** | Chiedza | **Gender** | Female |
| **Date of Birth** | 25/05/1982 | **Nationality** | Zimbabwean |
| **National ID** | 22-3344556 G 22 | **Marital Status** | Married |
| **Educational Level** | Tertiary Level | **Race** | African |
| **Residential Address** | 14 Murambi, Mutare | **Occupation** | Businesswoman |
| **Father's Name** | Fanuel Mutasa | **District** | Mutasa |
| **Chief** | Chief Mutasa | **Headman** | Mutasa |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Fanuel Mutasa Jnr | **Relationship** | Brother |
| **Address** | 14 Murambi, Mutare | **Contact Number** | 0716 000 115 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0115 |
| **Cash held** | USD 300.00 · ZAR 1500.00 · GBP 20.00 — 3 currency lines |
| **Clothing (tick, then colour)** | Dress (Purple) · Shoes (Brown) · Jersey (Black) |
| **Other property** | Gold ring, handbag (brown), diary |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Fraud | Mutare Magistrates Court | Convicted | 18 months | Sentenced 04/11/2026 | – (consecutive) | – | – |
| 2 | Count 2 - Money Laundering | Harare Magistrates Court | Unconvicted | – | Remand from 04/11/2026; next court 01/12/2026 | – | USD 500.00 | – |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 18 months |
| Total sentence | 18 months (1 year 6 months) = **547 days** from 04/11/2026 |
| Remission | 547 ÷ 3 = **182 days** |
| EDR | **03/11/2027** |
| ODR | **03/05/2028** |
| Unconvicted count(s) | Still before the court; next court 01/12/2026 |
| Calculated class | D |

---

### 3.16 0116/26 · Prosper Mhlanga

> **Group E: Mixed convicted and unconvicted, with and without restitution.** Mixed: two convicted (consecutive, restitution on Count 2) and one unconvicted.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0116/26 |
| **CRB Number** | CRB 182/10/26 | **First-time offender** | No (untick) |
| **Admission date** | 05/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Prosper | **Surname** | Mhlanga |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 19/12/1995 | **Nationality** | Zimbabwean |
| **National ID** | 08-2223334 P 08 | **Marital Status** | Single |
| **Educational Level** | Ordinary Level | **Race** | African |
| **Residential Address** | 221 Ascot, Gweru | **Occupation** | Security guard |
| **Father's Name** | Enock Mhlanga | **District** | Gweru |
| **Chief** | – | **Headman** |  |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Enock Mhlanga | **Relationship** | Father |
| **Address** | 221 Ascot, Gweru | **Contact Number** | 0717 000 116 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0116 |
| **Cash held** | ZWG 450.00 |
| **Clothing (tick, then colour)** | Trousers (Black) · Jersey (Blue) · Shoes (Black) · Socks (Grey) |
| **Other property** | Security company ID card, baton (handed to employer) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Assault | Gweru Regional Court | Convicted | 6 months | Sentenced 05/11/2026 | – (consecutive) | – | – |
| 2 | Count 2 - Theft | Gweru Regional Court | Convicted | 1 year | Sentenced 05/11/2026 | – (consecutive) | – | – |
| 3 | Count 3 - Robbery | Gweru Regional Court | Unconvicted | – | Remand from 05/11/2026; next court 30/11/2026 | – | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 2 | USD 300.00 | 10/12/2026 | 3 months | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 6 months; Count 2: 12 months = **18 months** |
| Total sentence | 18 months (1 year 6 months) = **547 days** from 05/11/2026 |
| Remission | 547 ÷ 3 = **182 days** |
| EDR | **04/11/2027** |
| ODR | **04/05/2028** |
| If restitution paid | 547 − 90 remitted = 457 days; remission 152 |
| EDR / ODR if paid | **05/09/2027** / **04/02/2028** |
| Unconvicted count(s) | Still before the court; next court 30/11/2026 |
| Calculated class | D |

---

### 3.17 0117/26 · Lloyd Tawanda Marufu

> **Group E: Mixed convicted and unconvicted, with and without restitution.** Mixed: two convicted (concurrent) and one unconvicted, no restitution.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0117/26 |
| **CRB Number** | CRB 191/10/26 | **First-time offender** | No (untick) |
| **Admission date** | 06/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Lloyd | **Surname** | Marufu |
| **Other Names** | Tawanda | **Gender** | Male |
| **Date of Birth** | 30/07/1988 | **Nationality** | Zimbabwean |
| **National ID** | 58-4445556 L 58 | **Marital Status** | Married |
| **Educational Level** | Advanced Level | **Race** | African |
| **Residential Address** | 5 Rhodene, Masvingo | **Occupation** | Electrician |
| **Father's Name** | Tawanda Marufu | **District** | Masvingo |
| **Chief** | Chief Charumbira | **Headman** | Marufu |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Sarah Marufu | **Relationship** | Wife |
| **Address** | 5 Rhodene, Masvingo | **Contact Number** | 0718 000 117 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0117 |
| **Cash held** | USD 45.00 · ZWG 700.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Trousers (Blue) · T-shirts (Green) · Shoes (Brown) |
| **Other property** | Tool belt, mobile phone (Tecno, grey) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Housebreaking with Intent to Steal | Masvingo Regional Court | Convicted | 2 years | Sentenced 06/11/2026 | – | – | – |
| 2 | Count 2 - Theft | Masvingo Regional Court | Convicted | 18 months | Sentenced 06/11/2026 | Count 1 | – | – |
| 3 | Count 3 - Malicious Damage to Property | Masvingo Regional Court | Unconvicted | – | Remand from 06/11/2026; next court 02/12/2026 | – | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Working | Counts 1 ∥ 2 concurrent → 24 months (longest) |
| Total sentence | 24 months (2 years) = **731 days** from 06/11/2026 |
| Remission | 731 ÷ 3 = **243 days** |
| EDR | **07/03/2028** |
| ODR | **05/11/2028** |
| Unconvicted count(s) | Still before the court; next court 02/12/2026 |
| Calculated class | D |

---

### 3.18 0118/26 · Edmore Kanengoni

> **Group F: Total sentence: concurrent and consecutive counts with restitution.** Four convicted counts: 1 and 2 concurrent, 3 (restitution) and 4 consecutive.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0118/26 |
| **CRB Number** | CRB 120/10/26 | **First-time offender** | No (untick) |
| **Admission date** | 02/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Edmore | **Surname** | Kanengoni |
| **Other Names** | – | **Gender** | Male |
| **Date of Birth** | 08/03/1986 | **Nationality** | Zimbabwean |
| **National ID** | 63-5556667 E 63 | **Marital Status** | Married |
| **Educational Level** | Primary | **Race** | African |
| **Residential Address** | Farm 18, Featherstone, Chikomba | **Occupation** | Tractor driver |
| **Father's Name** | Shadreck Kanengoni | **District** | Chikomba |
| **Chief** | Chief Neshangwe | **Headman** | Kanengoni |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Ruth Kanengoni | **Relationship** | Wife |
| **Address** | Farm 18, Featherstone, Chikomba | **Contact Number** | 0719 000 118 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0118 |
| **Cash held** | USD 18.00 · ZWG 260.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Trousers (Green) · T-shirts (Grey) · Shoes (Black) · Jersey (Brown) |
| **Other property** | Wrist watch (silver) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Robbery | Masvingo Regional Court | Convicted | 4 years | Sentenced 02/11/2026 | – | – | – |
| 2 | Count 2 - Theft | Masvingo Regional Court | Convicted | 2 years | Sentenced 02/11/2026 | Count 1 | – | – |
| 3 | Count 3 - Unlawful Entry | Masvingo Regional Court | Convicted | 18 months | Sentenced 02/11/2026 | – (consecutive) | – | – |
| 4 | Count 4 - Theft | Masvingo Regional Court | Convicted | 1 year | Sentenced 02/11/2026 | – (consecutive) | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 3 | USD 900.00 | 15/01/2027 | 6 months | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Counts 1 ∥ 2 concurrent → 48 months (longest); Count 3: 18 months; Count 4: 12 months = **78 months** |
| Total sentence | 78 months (6 years 6 months) = **2,373 days** from 02/11/2026 |
| Remission | 2,373 ÷ 3 = **791 days** |
| EDR | **02/03/2031** |
| ODR | **01/05/2033** |
| If restitution paid | 2,373 − 180 remitted = 2,193 days; remission 731 |
| EDR / ODR if paid | **02/11/2030** / **02/11/2032** |
| Calculated class | C |

---

### 3.19 0119/26 · Fadzai Matanda

> **Group F: Total sentence: concurrent and consecutive counts with restitution.** Three convicted counts: 1 and 2 concurrent, both with restitution; 3 consecutive.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0119/26 |
| **CRB Number** | CRB 115/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 03/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Fadzai | **Surname** | Matanda |
| **Other Names** | – | **Gender** | Female |
| **Date of Birth** | 10/10/1990 | **Nationality** | Zimbabwean |
| **National ID** | 63-6667778 F 63 | **Marital Status** | Single |
| **Educational Level** | Tertiary Level | **Race** | African |
| **Residential Address** | 2 Mushandirapamwe Flats, Chivhu | **Occupation** | Cashier |
| **Father's Name** | Wilson Matanda | **District** | Chikomba |
| **Chief** | Chief Mutekedza | **Headman** | Matanda |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Wilson Matanda | **Relationship** | Father |
| **Address** | 2 Mushandirapamwe Flats, Chivhu | **Contact Number** | 0731 000 119 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0119 |
| **Cash held** | USD 70.00 · EUR 50.00 — 2 currency lines |
| **Clothing (tick, then colour)** | Blouse (Yellow) · Skirt (Grey) · Shoes (Black) · Jersey (Red) |
| **Other property** | Handbag (red), ID card |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Theft by Employee | Gweru Regional Court | Convicted | 3 years | Sentenced 03/11/2026 | – | – | – |
| 2 | Count 2 - Fraud | Gweru Regional Court | Convicted | 2 years | Sentenced 03/11/2026 | Count 1 | – | – |
| 3 | Count 3 - Forgery | Gweru Regional Court | Convicted | 1 year | Sentenced 03/11/2026 | – (consecutive) | – | – |

**Restitution**

| Count | Amount | Due date | Remitted if paid | Status |
|---|---|---|---|---|
| 1 | USD 4,000.00 | 31/01/2027 | 1 year | Pending |
| 2 | USD 1,500.00 | 31/01/2027 | 6 months | Pending |

**Expected results**

| Check | Expected |
|---|---|
| Working | Counts 1 ∥ 2 concurrent → 36 months (longest); Count 3: 12 months = **48 months** |
| Total sentence | 48 months (4 years) = **1,461 days** from 03/11/2026 |
| Remission | 1,461 ÷ 3 = **487 days** |
| EDR | **03/07/2029** |
| ODR | **02/11/2030** |
| If restitution paid | 1,461 − 545 remitted = 916 days; remission 305 |
| EDR / ODR if paid | **05/07/2028** / **06/05/2029** |
| Calculated class | C |

---

### 3.20 0120/26 · Sipho Bongani Ncube

> **Group F: Total sentence: concurrent and consecutive counts with restitution.** Two convicted counts, consecutive, fine option on Count 1, foreign national.

**Section 1: Prison details**

| Field | Value | Field | Value |
|---|---|---|---|
| **Admission Type** | New Admission | **Prison Number** | 0120/26 |
| **CRB Number** | CRB 205/10/26 | **First-time offender** | Yes (ticked) |
| **Admission date** | 04/11/2026 |  |  |

**Section 2: Personal details and local home history**

| Field | Value | Field | Value |
|---|---|---|---|
| **Name** | Sipho | **Surname** | Ncube |
| **Other Names** | Bongani | **Gender** | Male |
| **Date of Birth** | 28/08/1983 | **Nationality** | South African |
| **National ID** | Leave blank (foreign national) | **Marital Status** | Married |
| **Educational Level** | Advanced Level | **Race** | African |
| **Residential Address** | 17 Main Road, Musina, Limpopo, South Africa | **Occupation** | Truck driver |
| **Father's Name** | Bongani Ncube | **District** | Beitbridge |
| **Chief** | – | **Headman** |  |

**Section 3: Next of kin**

| Field | Value | Field | Value |
|---|---|---|---|
| **Full Name** | Nomsa Ncube | **Relationship** | Wife |
| **Address** | 17 Main Road, Musina, South Africa | **Contact Number** | +27 82 000 0120 |

**Sections 4–5: Property and valuables**

| Item | Entry |
|---|---|
| **Property Bag Number** | B-0120 |
| **Cash held** | ZAR 4000.00 · USD 100.00 · BWP 150.00 — 3 currency lines |
| **Clothing (tick, then colour)** | Trousers (Black) · T-shirts (Blue) · Shoes (Brown) · Cap (White) · Wallet (Black) |
| **Other property** | South African passport (held by Immigration), truck keys (handed to employer) |

**Offences**

| Count | Offence | Court | Status | Sentence | Dates | Concurrent with | Bail | Fine |
|---|---|---|---|---|---|---|---|---|
| 1 | Count 1 - Smuggling (undeclared goods) | Beitbridge Magistrates Court | Convicted | 2 years | Sentenced 04/11/2026 | – (consecutive) | – | USD 1,000.00 |
| 2 | Count 2 - Contravening Immigration Act (overstay) | Beitbridge Magistrates Court | Convicted | 6 months | Sentenced 04/11/2026 | – (consecutive) | – | – |

**Expected results**

| Check | Expected |
|---|---|
| Working | Count 1: 24 months; Count 2: 6 months = **30 months** |
| Total sentence | 30 months (2 years 6 months) = **912 days** from 04/11/2026 |
| Remission | 912 ÷ 3 = **304 days** |
| EDR | **03/07/2028** |
| ODR | **03/05/2029** |
| Fine option | If the fine is paid, discharge that count with reason *Fine* |
| Calculated class | B |

---

## 4. Points to Watch During Entry

Found while calculating these records. Check them on the server and report what you see.

| Inmate | What to check |
|---|---|
| 0119/26 | Restitution on two **concurrent** counts. PMS takes off both remitted periods (1 year + 6 months = 545 days), although Count 2 runs inside Count 1. If only Count 1's year should be remitted, the paid figures would be 1,096 days, EDR 02/11/2028 and ODR 02/11/2029 instead of those shown. |
| 0111/26 | Class for **concurrent** counts. PMS adds both 9-year counts when working out the class, so it gives **D**. Counted once, time to serve is about 72 months, which would be **C**. |
| All with restitution | Remitted restitution months count as 30 days and years as 365, while sentences use calendar months. Paid dates can differ by a day or two from a calendar count. |
| 0107/26 | Robbery, 10 years, gives class **C**, not D: the class uses time to serve after remission (about 80 months), which is under 84. |
