flowchart TD
A[Start Inmate Registration] --> B[Basic Inmate Registration]
B --> C[Enter Inmate Details<br/>prison_number, name, DOB, etc.]
C --> D[Enter Next of Kin<br/>full_name, relationship, address, contact]
D --> E[Enter Classification<br/>classification, remarks]
E --> F[Enter Valuables<br/>cash, items, etc.]
F --> G[Submit Basic Registration]
G --> H[Basic Registration Complete<br/>Inmate created with ID]

    H --> I[Offence Registration]
    I --> J[Select Existing Inmate<br/>from database]
    J --> K[Add Offences<br/>Loop for each offence]

    K --> L{Conviction Status?}
    L -->|Convicted| M[Enter Offence Details<br/>offence, court, furtherCharge]
    M --> N[Enter Mandatory Convicted Data<br/>sentence, sentenceDate, remission]
    N --> O[Enter Restitution Details<br/>amount, date, status, etc.]
    O --> P[Offence Complete]

    L -->|Unconvicted| Q[Enter Offence Details<br/>offence, court, furtherCharge]
    Q --> R[Enter Mandatory Unconvicted Data<br/>nextCourtDate]
    R --> P[Offence Complete]

    P --> S{More Offences?}
    S -->|Yes| K
    S -->|No| T[Enter Release Dates<br/>if any convicted offences]
    T --> U[Submit Offence Registration]
    U --> V[Registration Complete]
