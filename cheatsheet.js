// cheatsheet.js — Edgar+ Cheat Sheet content (C, as used in FER's UPRO course on Edgar).
// Snippets can be inserted into the editor; `includes` are added at the top of the file if missing.
// kind: 'toplevel'   -> functions/types; inserted above the function the cursor is in
//       'statements' -> code for inside a function; indented to the cursor
//       'program'    -> a whole program
// In text fields, `backticks` are rendered as inline code. Content is shown in the language picked in
// Edgar+ settings (Croatian or English); search matches both.
(function () {
    'use strict';
    const EP = window.EdgarPlus = window.EdgarPlus || {};
    if (EP.cheatsheet) return;

    const snippets = [
        // ---------------------------------------------------------------- Basics
        {
            id: 'skeleton', cat: 'Osnove / Basics',
            hr: 'Kostur programa', en: 'Program skeleton',
            dHr: 'Minimalni program koji se prevodi s Edgarovim postavkama (`-std=c11 -pedantic`).',
            dEn: 'Minimal program that compiles with Edgar\'s settings (`-std=c11 -pedantic`).',
            tags: 'main include stdio template', kind: 'program', includes: [],
            code: String.raw`#include <stdio.h>

int main(void) {

    return 0;
}`
        },
        {
            id: 'input-validate', cat: 'Osnove / Basics',
            hr: 'Unos s ponavljanjem dok nije ispravan', en: 'Repeat input until valid',
            dHr: 'Tipičan zahtjev u zadacima: "unos ponavljati sve dok ...". Petlja `do-while` izvodi se barem jednom.',
            dEn: 'Typical task requirement: "repeat the input until ...". A `do-while` loop runs at least once.',
            tags: 'scanf do while provjera validacija granice interval', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`int n;
do {
    printf("Upisite n (1-100) > ");
    scanf("%d", &n);
} while (n < 1 || n > 100);`
        },
        {
            id: 'read-eof', cat: 'Osnove / Basics',
            hr: 'Čitanje do kraja ulaza (EOF)', en: 'Read until end of input (EOF)',
            dHr: '`scanf` vraća broj uspješno pročitanih vrijednosti, a `EOF` na kraju ulaza. Petlja staje i kad se upiše nešto što nije broj.',
            dEn: '`scanf` returns the number of values read, or `EOF` at end of input. The loop also stops on non-numeric input.',
            tags: 'scanf eof kraj ulaza nepoznat broj', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`int x;
while (scanf("%d", &x) == 1) {
    /* obradi x */
}`
        },
        {
            id: 'switch-menu', cat: 'Osnove / Basics',
            hr: 'Izbornik sa switch', en: 'Menu with switch',
            dHr: 'Razmak u `" %c"` preskače `\\n` koji je ostao od prethodnog unosa. Ne zaboravi `break`.',
            dEn: 'The space in `" %c"` skips the `\\n` left over from previous input. Don\'t forget `break`.',
            tags: 'switch case break char izbornik menu', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`char c;
scanf(" %c", &c);
switch (c) {
    case 'a':
    case 'A':
        /* ... */
        break;
    case 'b':
        /* ... */
        break;
    default:
        printf("Nepoznata opcija\n");
        break;
}`
        },
        {
            id: 'pattern', cat: 'Osnove / Basics',
            hr: 'Crtanje lika zvjezdicama', en: 'Drawing a shape with stars',
            dHr: 'Ugniježđene petlje: vanjska po recima, unutarnje za razmake i znakove.',
            dEn: 'Nested loops: the outer loop goes over rows, the inner ones print spaces and characters.',
            tags: 'trokut piramida zvjezdice putchar ugnijezdene petlje triangle pyramid', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`/* piramida visine n */
for (int i = 1; i <= n; i++) {
    for (int j = 0; j < n - i; j++) putchar(' ');
    for (int j = 0; j < 2 * i - 1; j++) putchar('*');
    putchar('\n');
}`
        },
        {
            id: 'leap-year', cat: 'Osnove / Basics',
            hr: 'Prijestupna godina i broj dana u mjesecu', en: 'Leap year and days in a month',
            dHr: 'Godina je prijestupna ako je djeljiva s 4, a nije sa 100, ili je djeljiva s 400.',
            dEn: 'A year is a leap year if divisible by 4 but not by 100, or divisible by 400.',
            tags: 'datum godina mjesec dan date', kind: 'toplevel', includes: [],
            code: String.raw`int isLeapYear(int y) {
    return (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
}

int daysInMonth(int m, int y) {
    static const int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};
    return (m == 2 && isLeapYear(y)) ? 29 : days[m - 1];
}`
        },
        {
            id: 'random', cat: 'Osnove / Basics',
            hr: 'Slučajni brojevi', en: 'Random numbers',
            dHr: '`srand` pozovi samo jednom na početku programa.',
            dEn: 'Call `srand` only once, at the start of the program.',
            tags: 'rand srand time random slucajni', kind: 'statements', includes: ['stdlib.h', 'time.h'],
            code: String.raw`srand((unsigned) time(NULL));
int die = rand() % 6 + 1;              /* 1..6 */
int r = lo + rand() % (hi - lo + 1);   /* lo..hi */
double u = rand() / (RAND_MAX + 1.0);  /* [0, 1) */`
        },
        {
            id: 'random-funcs', cat: 'Osnove / Basics',
            hr: 'Slučajni brojevi: funkcije i miješanje polja', en: 'Random numbers: helper functions and shuffle',
            dHr: 'Prije prvog poziva jednom u `main` pozovi `srand(sjeme)` ili `srand((unsigned) time(NULL))`. `shuffle` (Fisher-Yates) miješa polje tako da je svaki raspored jednako vjerojatan.',
            dEn: 'Before the first call, call `srand(seed)` or `srand((unsigned) time(NULL))` once in `main`. `shuffle` (Fisher-Yates) mixes the array so that every order is equally likely.',
            tags: 'rand srand slucajni random interval raspon range double shuffle promijesaj mijesanje fisher yates slucajni niz string popuni fill', kind: 'toplevel', includes: ['stdlib.h'],
            code: String.raw`/* slučajni cijeli broj iz [lo, hi] */
int randomInt(int lo, int hi) {
    return lo + rand() % (hi - lo + 1);
}

/* slučajni realni broj iz [lo, hi] */
double randomDouble(double lo, double hi) {
    return lo + (hi - lo) * (rand() / (double) RAND_MAX);
}

void fillRandom(int arr[], int n, int lo, int hi) {
    for (int i = 0; i < n; i++) {
        arr[i] = randomInt(lo, hi);
    }
}

/* Fisher-Yates: miješa polje, svaki raspored je jednako vjerojatan */
void shuffle(int arr[], int n) {
    for (int i = n - 1; i > 0; i--) {
        int j = rand() % (i + 1);       /* 0..i */
        int tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

/* len slučajnih velikih slova; s mora imati barem len + 1 mjesta */
void randomString(char s[], int len) {
    for (int i = 0; i < len; i++) {
        s[i] = (char) ('A' + rand() % 26);
    }
    s[len] = '\0';
}`,
            codeEn: String.raw`/* random integer from [lo, hi] */
int randomInt(int lo, int hi) {
    return lo + rand() % (hi - lo + 1);
}

/* random real number from [lo, hi] */
double randomDouble(double lo, double hi) {
    return lo + (hi - lo) * (rand() / (double) RAND_MAX);
}

void fillRandom(int arr[], int n, int lo, int hi) {
    for (int i = 0; i < n; i++) {
        arr[i] = randomInt(lo, hi);
    }
}

/* Fisher-Yates: shuffles the array, every order is equally likely */
void shuffle(int arr[], int n) {
    for (int i = n - 1; i > 0; i--) {
        int j = rand() % (i + 1);       /* 0..i */
        int tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

/* len random uppercase letters; s needs room for at least len + 1 chars */
void randomString(char s[], int len) {
    for (int i = 0; i < len; i++) {
        s[i] = (char) ('A' + rand() % 26);
    }
    s[len] = '\0';
}`
        },

        // ---------------------------------------------------------------- Numbers
        {
            id: 'prime', cat: 'Brojevi / Numbers',
            hr: 'Je li broj prost', en: 'Is a number prime',
            dHr: 'Dovoljno je provjeriti djelitelje do korijena. `d <= n / d` izbjegava preljev koji bi mogao nastati kod `d * d`.',
            dEn: 'Checking divisors up to the square root is enough. `d <= n / d` avoids the overflow `d * d` could cause.',
            tags: 'prost prim djeljivost prime divisor', kind: 'toplevel', includes: [],
            code: String.raw`int isPrime(int n) {
    if (n < 2) return 0;
    for (int d = 2; d <= n / d; d++) {
        if (n % d == 0) return 0;
    }
    return 1;
}`
        },
        {
            id: 'gcd', cat: 'Brojevi / Numbers',
            hr: 'NZD i NZV (Euklidov algoritam)', en: 'GCD and LCM (Euclid)',
            dHr: 'Najveći zajednički djelitelj i najmanji zajednički višekratnik. NZV dijeli prije množenja da se izbjegne preljev.',
            dEn: 'Greatest common divisor and least common multiple. LCM divides before multiplying to avoid overflow.',
            tags: 'nzd nzv gcd lcm euklid djelitelj visekratnik', kind: 'toplevel', includes: [],
            code: String.raw`int gcd(int a, int b) {
    while (b != 0) {
        int r = a % b;
        a = b;
        b = r;
    }
    return a < 0 ? -a : a;
}

int lcm(int a, int b) {          /* a, b > 0 */
    return a / gcd(a, b) * b;
}`
        },
        {
            id: 'factorial-fib', cat: 'Brojevi / Numbers',
            hr: 'Faktorijel i Fibonacci', en: 'Factorial and Fibonacci',
            dHr: '20! je najveći faktorijel koji stane u `long long`; F(92) je najveći Fibonaccijev broj koji stane.',
            dEn: '20! is the largest factorial that fits in `long long`; F(92) is the largest Fibonacci number that fits.',
            tags: 'faktorijel factorial fibonacci rekurzija recursion', kind: 'toplevel', includes: [],
            code: String.raw`long long factorial(int n) {
    long long f = 1;
    for (int i = 2; i <= n; i++) f *= i;
    return f;
}

long long factorialRec(int n) {
    return n <= 1 ? 1 : n * factorialRec(n - 1);
}

long long fibonacci(int n) {     /* F(0) = 0, F(1) = 1 */
    if (n == 0) return 0;
    long long a = 0, b = 1;
    for (int i = 1; i < n; i++) {
        long long t = a + b;
        a = b;
        b = t;
    }
    return b;
}`
        },
        {
            id: 'digits', cat: 'Brojevi / Numbers',
            hr: 'Znamenke broja', en: 'Digits of a number',
            dHr: '`n % 10` daje zadnju znamenku, `n / 10` je uklanja. Palindrom broja: `n == reverseNumber(n)`.',
            dEn: '`n % 10` gives the last digit, `n / 10` removes it. Number palindrome: `n == reverseNumber(n)`.',
            tags: 'znamenke zbroj obrnuti palindrom broj digits sum reverse count', kind: 'toplevel', includes: [],
            code: String.raw`int digitSum(int n) {
    int sum = 0;
    if (n < 0) n = -n;
    while (n > 0) {
        sum += n % 10;
        n /= 10;
    }
    return sum;
}

int reverseNumber(int n) {       /* 1230 -> 321 */
    int r = 0;
    while (n != 0) {
        r = r * 10 + n % 10;
        n /= 10;
    }
    return r;
}

int countDigits(int n) {
    int c = 1;
    while (n / 10 != 0) {
        n /= 10;
        c++;
    }
    return c;
}`
        },
        {
            id: 'base-conv', cat: 'Brojevi / Numbers',
            hr: 'Binarni ispis i pretvorba baze', en: 'Binary printing and base conversion',
            dHr: 'Za obrnuti smjer (string u broj) koristi `strtol(s, NULL, baza)`.',
            dEn: 'For the other direction (string to number) use `strtol(s, NULL, base)`.',
            tags: 'binarno heksadekadsko oktalno baza pretvorba binary hex base convert bitovi', kind: 'toplevel', includes: ['stdio.h'],
            code: String.raw`/* ispis svih 32 bita, grupirano po 8 */
void printBinary(unsigned int x) {
    for (int i = 31; i >= 0; i--) {
        putchar((x >> i) & 1u ? '1' : '0');
        if (i % 8 == 0 && i != 0) putchar(' ');
    }
    putchar('\n');
}

/* x u bazi 2..16; out mora imati barem 33 mjesta */
void toBase(unsigned int x, unsigned int base, char out[]) {
    const char digits[] = "0123456789ABCDEF";
    char tmp[33];
    int len = 0;
    do {
        tmp[len++] = digits[x % base];
        x /= base;
    } while (x > 0);
    for (int i = 0; i < len; i++) out[i] = tmp[len - 1 - i];
    out[len] = '\0';
}`
        },
        {
            id: 'bits', cat: 'Brojevi / Numbers',
            hr: 'Rad s bitovima', en: 'Bit manipulation',
            dHr: 'Bit 0 je najmanje značajan. Koristi `unsigned` tipove i `1u` da izbjegneš probleme s predznakom. Više trikova je u tablici "Bitovni trikovi".',
            dEn: 'Bit 0 is the least significant. Use `unsigned` types and `1u` to avoid sign issues. More tricks are in the "Bit tricks" table.',
            tags: 'bit maska postavi obrisi invertiraj broj jedinica mask set clear toggle popcount shift', kind: 'toplevel', includes: [],
            code: String.raw`int getBit(unsigned int x, int k)             { return (x >> k) & 1u; }
unsigned int setBit(unsigned int x, int k)    { return x | (1u << k); }
unsigned int clearBit(unsigned int x, int k)  { return x & ~(1u << k); }
unsigned int toggleBit(unsigned int x, int k) { return x ^ (1u << k); }

int countOnes(unsigned int x) {
    int c = 0;
    while (x) {
        c += x & 1u;
        x >>= 1;
    }
    return c;
}`
        },
        {
            id: 'bit-fields', cat: 'Brojevi / Numbers',
            hr: 'Izdvajanje i upis skupine bitova', en: 'Extract and set a group of bits',
            dHr: 'Za zadatke tipa "bitovi 4 do 7 broja x". Bitovi se broje od 0 (najmanje značajan). Primjer: `extractBits(0xD6, 2, 5)` vraća 5, a `setBits(0, 4, 7, 9)` vraća `0x90`.',
            dEn: 'For tasks like "bits 4 to 7 of x". Bits are numbered from 0 (least significant). Example: `extractBits(0xD6, 2, 5)` returns 5, and `setBits(0, 4, 7, 9)` returns `0x90`.',
            tags: 'bit bitovi maska izdvoji skupina polje bitova raspon extract field mask nibble range', kind: 'toplevel', includes: [],
            code: String.raw`/* maska s k najnižih jedinica: lowMask(4) = 0xF (1111); k od 0 do 32 */
unsigned int lowMask(int k) {
    return k >= 32 ? 0xFFFFFFFFu : (1u << k) - 1u;
}

/* bitovi lo..hi broja x, pomaknuti na početak: extractBits(0xD6, 2, 5) = 5 */
unsigned int extractBits(unsigned int x, int lo, int hi) {
    return (x >> lo) & lowMask(hi - lo + 1);
}

/* upisuje value u bitove lo..hi broja x; ostali bitovi ostaju isti */
unsigned int setBits(unsigned int x, int lo, int hi, unsigned int value) {
    unsigned int mask = lowMask(hi - lo + 1) << lo;
    return (x & ~mask) | ((value << lo) & mask);
}`,
            codeEn: String.raw`/* mask of the k lowest bits: lowMask(4) = 0xF (1111); k from 0 to 32 */
unsigned int lowMask(int k) {
    return k >= 32 ? 0xFFFFFFFFu : (1u << k) - 1u;
}

/* bits lo..hi of x, shifted down to bit 0: extractBits(0xD6, 2, 5) = 5 */
unsigned int extractBits(unsigned int x, int lo, int hi) {
    return (x >> lo) & lowMask(hi - lo + 1);
}

/* writes value into bits lo..hi of x; the other bits stay the same */
unsigned int setBits(unsigned int x, int lo, int hi, unsigned int value) {
    unsigned int mask = lowMask(hi - lo + 1) << lo;
    return (x & ~mask) | ((value << lo) & mask);
}`
        },
        {
            id: 'bit-rotate', cat: 'Brojevi / Numbers',
            hr: 'Rotacija i obrtanje bitova', en: 'Rotate and reverse bits',
            dHr: 'Kod rotacije se bitovi koji ispadnu s jedne strane vraćaju s druge (za razliku od `<<` i `>>`). Pretpostavlja 32-bitni `unsigned int`, kao na Edgaru. Primjer: `rotateBitsLeft(0x12345678, 4)` daje `0x23456781`.',
            dEn: 'With rotation, the bits that fall off one end come back in at the other (unlike `<<` and `>>`). Assumes a 32-bit `unsigned int`, as on Edgar. Example: `rotateBitsLeft(0x12345678, 4)` gives `0x23456781`.',
            tags: 'rotacija ciklicki posmak rotate circular shift obrni bitove reverse bits bit', kind: 'toplevel', includes: [],
            code: String.raw`/* ciklički posmak ulijevo za k mjesta (k >= 0) */
unsigned int rotateBitsLeft(unsigned int x, int k) {
    k %= 32;
    if (k == 0) return x;               /* x >> 32 bi bilo nedefinirano */
    return (x << k) | (x >> (32 - k));
}

unsigned int rotateBitsRight(unsigned int x, int k) {
    k %= 32;
    if (k == 0) return x;
    return (x >> k) | (x << (32 - k));
}

/* obrće redoslijed bitova: bit 0 postaje bit 31 */
unsigned int reverseBits(unsigned int x) {
    unsigned int result = 0;
    for (int i = 0; i < 32; i++) {
        result = (result << 1) | (x & 1u);
        x >>= 1;
    }
    return result;
}`,
            codeEn: String.raw`/* circular shift left by k places (k >= 0) */
unsigned int rotateBitsLeft(unsigned int x, int k) {
    k %= 32;
    if (k == 0) return x;               /* x >> 32 would be undefined */
    return (x << k) | (x >> (32 - k));
}

unsigned int rotateBitsRight(unsigned int x, int k) {
    k %= 32;
    if (k == 0) return x;
    return (x >> k) | (x << (32 - k));
}

/* reverses the bit order: bit 0 becomes bit 31 */
unsigned int reverseBits(unsigned int x) {
    unsigned int result = 0;
    for (int i = 0; i < 32; i++) {
        result = (result << 1) | (x & 1u);
        x >>= 1;
    }
    return result;
}`
        },
        {
            id: 'float-compare', cat: 'Brojevi / Numbers',
            hr: 'Usporedba realnih brojeva i zaokruživanje', en: 'Comparing floats and rounding',
            dHr: 'Realne brojeve ne uspoređuj s `==` (npr. `0.1 + 0.2 != 0.3`). Za `fabs`, `round` i `lround` treba `math.h`.',
            dEn: 'Don\'t compare floating-point numbers with `==` (e.g. `0.1 + 0.2 != 0.3`). `fabs`, `round` and `lround` need `math.h`.',
            tags: 'epsilon fabs round zaokruzivanje decimale float double usporedba compare', kind: 'statements', includes: ['math.h'],
            code: String.raw`const double EPS = 1e-9;
if (fabs(a - b) < EPS) {
    /* a i b smatramo jednakima */
}

double r2 = round(x * 100.0) / 100.0;   /* na 2 decimale */
long nearest = lround(x);               /* najbliži cijeli broj */
int truncated = (int) x;                /* odsijecanje prema nuli */`
        },

        // ---------------------------------------------------------------- Arrays
        {
            id: 'array-io', cat: 'Polja / Arrays',
            hr: 'Učitavanje i ispis polja', en: 'Read and print an array',
            dHr: 'Polje se u funkciju prenosi kao pokazivač, pa funkcija mora dobiti i broj elemenata.',
            dEn: 'An array is passed to a function as a pointer, so the function also needs the element count.',
            tags: 'polje ucitaj ispisi array read print scanf', kind: 'toplevel', includes: ['stdio.h'],
            code: String.raw`void readArray(int arr[], int n) {
    for (int i = 0; i < n; i++) {
        scanf("%d", &arr[i]);
    }
}

void printArray(const int arr[], int n) {
    for (int i = 0; i < n; i++) {
        printf("%d%s", arr[i], i < n - 1 ? " " : "\n");
    }
}`
        },
        {
            id: 'minmax-avg', cat: 'Polja / Arrays',
            hr: 'Minimum, maksimum i prosjek', en: 'Minimum, maximum and average',
            dHr: 'Više povratnih vrijednosti vraća se preko pokazivača. Prije dijeljenja pretvori zbroj u `double`.',
            dEn: 'Return several values through pointers. Cast the sum to `double` before dividing.',
            tags: 'min max najveci najmanji prosjek srednja vrijednost average mean zbroj sum', kind: 'toplevel', includes: [],
            code: String.raw`void minMax(const int arr[], int n, int *min, int *max) {
    *min = *max = arr[0];
    for (int i = 1; i < n; i++) {
        if (arr[i] < *min) *min = arr[i];
        if (arr[i] > *max) *max = arr[i];
    }
}

double average(const int arr[], int n) {
    long long sum = 0;
    for (int i = 0; i < n; i++) sum += arr[i];
    return n > 0 ? (double) sum / n : 0.0;
}`
        },
        {
            id: 'swap', cat: 'Polja / Arrays',
            hr: 'Zamjena dviju varijabli', en: 'Swap two variables',
            dHr: 'C prenosi argumente po vrijednosti, zato funkcija dobiva adrese: `swap(&a, &b);`',
            dEn: 'C passes arguments by value, so the function receives addresses: `swap(&a, &b);`',
            tags: 'zamjena swap pokazivac pointer', kind: 'toplevel', includes: [],
            code: String.raw`void swap(int *a, int *b) {
    int tmp = *a;
    *a = *b;
    *b = tmp;
}`
        },
        {
            id: 'reverse-array', cat: 'Polja / Arrays',
            hr: 'Obrtanje polja', en: 'Reverse an array',
            dHr: 'Dva indeksa idu jedan prema drugome i zamjenjuju elemente.',
            dEn: 'Two indices move towards each other, swapping elements.',
            tags: 'obrni okreni reverse polje', kind: 'toplevel', includes: [],
            code: String.raw`void reverseArray(int arr[], int n) {
    for (int i = 0, j = n - 1; i < j; i++, j--) {
        int tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}`
        },
        {
            id: 'insert-remove', cat: 'Polja / Arrays',
            hr: 'Ubacivanje i izbacivanje elementa', en: 'Insert and remove an element',
            dHr: 'Elementi se pomiču za jedno mjesto. Funkcije vraćaju novu duljinu polja.',
            dEn: 'Elements are shifted by one position. The functions return the new length.',
            tags: 'ubaci izbaci obrisi pomakni insert delete remove shift', kind: 'toplevel', includes: [],
            code: String.raw`/* izbacuje element s indeksom idx */
int removeAt(int arr[], int n, int idx) {
    for (int i = idx; i < n - 1; i++) {
        arr[i] = arr[i + 1];
    }
    return n - 1;
}

/* ubacuje value na indeks idx; polje mora imati mjesta za n + 1 element */
int insertAt(int arr[], int n, int idx, int value) {
    for (int i = n; i > idx; i--) {
        arr[i] = arr[i - 1];
    }
    arr[idx] = value;
    return n + 1;
}`
        },
        {
            id: 'frequency', cat: 'Polja / Arrays',
            hr: 'Brojanje pojavljivanja (histogram)', en: 'Counting occurrences (histogram)',
            dHr: 'Vrijednost služi kao indeks u polju brojača. Za slova: `freq[c - \'a\']++`.',
            dEn: 'The value is used as an index into a counter array. For letters: `freq[c - \'a\']++`.',
            tags: 'frekvencija histogram brojac pojavljivanja count occurrences', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`int freq[101] = {0};               /* vrijednosti 0..100 */
for (int i = 0; i < n; i++) {
    if (arr[i] >= 0 && arr[i] <= 100) freq[arr[i]]++;
}
for (int v = 0; v <= 100; v++) {
    if (freq[v] > 0) printf("%d: %d\n", v, freq[v]);
}`
        },
        {
            id: 'linear-search', cat: 'Polja / Arrays',
            hr: 'Slijedno pretraživanje', en: 'Linear search',
            dHr: 'Radi i na nesortiranom polju. Složenost O(n).',
            dEn: 'Works on unsorted arrays. Complexity O(n).',
            tags: 'pretrazivanje trazi linearno slijedno search find', kind: 'toplevel', includes: [],
            code: String.raw`int linearSearch(const int arr[], int n, int key) {
    for (int i = 0; i < n; i++) {
        if (arr[i] == key) return i;
    }
    return -1;
}`
        },
        {
            id: 'binary-search', cat: 'Polja / Arrays',
            hr: 'Binarno pretraživanje', en: 'Binary search',
            dHr: 'Polje mora biti sortirano uzlazno. Složenost O(log n). Vraća indeks ili -1.',
            dEn: 'The array must be sorted ascending. Complexity O(log n). Returns the index or -1.',
            tags: 'binarno pretrazivanje binary search bisection', kind: 'toplevel', includes: [],
            code: String.raw`int binarySearch(const int arr[], int n, int key) {
    int lo = 0, hi = n - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (arr[mid] == key) return mid;
        if (arr[mid] < key) lo = mid + 1;
        else hi = mid - 1;
    }
    return -1;
}`
        },

        // ---------------------------------------------------------------- Sorting
        {
            id: 'bubble-sort', cat: 'Sortiranje / Sorting',
            hr: 'Bubble sort (mjehuričasto sortiranje)', en: 'Bubble sort',
            dHr: 'Uzlazno. Za silazno promijeni `>` u `<`. Prekida rano ako u prolazu nije bilo zamjena.',
            dEn: 'Ascending. For descending change `>` to `<`. Stops early when a pass makes no swaps.',
            tags: 'sort sortiranje bubble mjehuricasto uzlazno silazno', kind: 'toplevel', includes: [],
            code: String.raw`void bubbleSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int swapped = 0;
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int tmp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
                swapped = 1;
            }
        }
        if (!swapped) break;
    }
}`
        },
        {
            id: 'selection-sort', cat: 'Sortiranje / Sorting',
            hr: 'Sortiranje izborom (selection sort)', en: 'Selection sort',
            dHr: 'U svakom koraku najmanji preostali element dolazi na svoje mjesto.',
            dEn: 'Each step moves the smallest remaining element into place.',
            tags: 'sort sortiranje selection izbor minimum', kind: 'toplevel', includes: [],
            code: String.raw`void selectionSort(int arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        int minIdx = i;
        for (int j = i + 1; j < n; j++) {
            if (arr[j] < arr[minIdx]) minIdx = j;
        }
        if (minIdx != i) {
            int tmp = arr[i];
            arr[i] = arr[minIdx];
            arr[minIdx] = tmp;
        }
    }
}`
        },
        {
            id: 'insertion-sort', cat: 'Sortiranje / Sorting',
            hr: 'Sortiranje umetanjem (insertion sort)', en: 'Insertion sort',
            dHr: 'Brz na gotovo sortiranim poljima (najbolji slučaj O(n)).',
            dEn: 'Fast on nearly sorted arrays (best case O(n)).',
            tags: 'sort sortiranje insertion umetanje', kind: 'toplevel', includes: [],
            code: String.raw`void insertionSort(int arr[], int n) {
    for (int i = 1; i < n; i++) {
        int key = arr[i];
        int j = i - 1;
        while (j >= 0 && arr[j] > key) {
            arr[j + 1] = arr[j];
            j--;
        }
        arr[j + 1] = key;
    }
}`
        },
        {
            id: 'merge-sort', cat: 'Sortiranje / Sorting',
            hr: 'Merge sort (sortiranje spajanjem)', en: 'Merge sort',
            dHr: 'O(n log n) i u najgorem slučaju, a stabilan je (jednaki elementi zadržavaju poredak). Poziv: `mergeSort(arr, n);`. Treba pomoćno polje od n elemenata, pa vraća 0 ako `malloc` ne uspije. Za silazno promijeni `arr[i] <= arr[j]` u `arr[i] >= arr[j]`.',
            dEn: 'O(n log n) even in the worst case, and stable (equal elements keep their order). Call: `mergeSort(arr, n);`. It needs a helper array of n elements, so it returns 0 if `malloc` fails. For descending order change `arr[i] <= arr[j]` to `arr[i] >= arr[j]`.',
            tags: 'merge sort spajanje sortiranje rekurzija podijeli pa vladaj divide conquer stabilno stable', kind: 'toplevel', includes: ['stdlib.h'],
            code: String.raw`/* spaja sortirane dijelove arr[lo..mid] i arr[mid+1..hi] */
void mergeHalves(int arr[], int tmp[], int lo, int mid, int hi) {
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
        if (arr[i] <= arr[j]) {             /* <= čuva stabilnost */
            tmp[k++] = arr[i++];
        } else {
            tmp[k++] = arr[j++];
        }
    }
    while (i <= mid) tmp[k++] = arr[i++];   /* ostatak lijevog dijela */
    while (j <= hi) tmp[k++] = arr[j++];    /* ostatak desnog dijela */
    for (k = lo; k <= hi; k++) arr[k] = tmp[k];
}

void mergeSortRange(int arr[], int tmp[], int lo, int hi) {
    if (lo >= hi) return;                   /* 0 ili 1 element je već sortiran */
    int mid = lo + (hi - lo) / 2;
    mergeSortRange(arr, tmp, lo, mid);
    mergeSortRange(arr, tmp, mid + 1, hi);
    mergeHalves(arr, tmp, lo, mid, hi);
}

/* poziv: mergeSort(arr, n); vraća 0 ako nema memorije */
int mergeSort(int arr[], int n) {
    if (n < 2) return 1;
    int *tmp = malloc(n * sizeof *tmp);
    if (tmp == NULL) return 0;
    mergeSortRange(arr, tmp, 0, n - 1);
    free(tmp);
    return 1;
}`,
            codeEn: String.raw`/* merges the sorted parts arr[lo..mid] and arr[mid+1..hi] */
void mergeHalves(int arr[], int tmp[], int lo, int mid, int hi) {
    int i = lo, j = mid + 1, k = lo;
    while (i <= mid && j <= hi) {
        if (arr[i] <= arr[j]) {             /* <= keeps the sort stable */
            tmp[k++] = arr[i++];
        } else {
            tmp[k++] = arr[j++];
        }
    }
    while (i <= mid) tmp[k++] = arr[i++];   /* rest of the left part */
    while (j <= hi) tmp[k++] = arr[j++];    /* rest of the right part */
    for (k = lo; k <= hi; k++) arr[k] = tmp[k];
}

void mergeSortRange(int arr[], int tmp[], int lo, int hi) {
    if (lo >= hi) return;                   /* 0 or 1 element is already sorted */
    int mid = lo + (hi - lo) / 2;
    mergeSortRange(arr, tmp, lo, mid);
    mergeSortRange(arr, tmp, mid + 1, hi);
    mergeHalves(arr, tmp, lo, mid, hi);
}

/* call: mergeSort(arr, n); returns 0 if out of memory */
int mergeSort(int arr[], int n) {
    if (n < 2) return 1;
    int *tmp = malloc(n * sizeof *tmp);
    if (tmp == NULL) return 0;
    mergeSortRange(arr, tmp, 0, n - 1);
    free(tmp);
    return 1;
}`
        },
        {
            id: 'quick-sort', cat: 'Sortiranje / Sorting',
            hr: 'Quicksort (brzo sortiranje)', en: 'Quicksort',
            dHr: 'Poziv: `quickSort(arr, 0, n - 1);` (zadnji argument je indeks zadnjeg elementa, a ne n). Stožer je srednji element, pa je brz i na već sortiranom polju. Za silazno promijeni `arr[i] < pivot` u `arr[i] > pivot`. Ako zadatak ne traži vlastiti algoritam, jednostavnije je koristiti `qsort`.',
            dEn: 'Call: `quickSort(arr, 0, n - 1);` (the last argument is the index of the last element, not n). The pivot is the middle element, so it is fast on already sorted arrays too. For descending order change `arr[i] < pivot` to `arr[i] > pivot`. If the task doesn\'t require your own algorithm, `qsort` is simpler.',
            tags: 'quicksort quick sort brzo sortiranje pivot stozer particija partition rekurzija recursion', kind: 'toplevel', includes: [],
            code: String.raw`/* dijeli arr[lo..hi]: lijevo od stožera manji, desno ostali; vraća indeks stožera */
int partition(int arr[], int lo, int hi) {
    int mid = lo + (hi - lo) / 2;
    int tmp = arr[mid];                 /* srednji element za stožer, premjesti ga na kraj */
    arr[mid] = arr[hi];
    arr[hi] = tmp;

    int pivot = arr[hi];
    int store = lo;                     /* sljedeće mjesto za element manji od stožera */
    for (int i = lo; i < hi; i++) {
        if (arr[i] < pivot) {
            tmp = arr[i];
            arr[i] = arr[store];
            arr[store] = tmp;
            store++;
        }
    }
    tmp = arr[store];                   /* stožer dolazi između dva dijela */
    arr[store] = arr[hi];
    arr[hi] = tmp;
    return store;
}

/* poziv: quickSort(arr, 0, n - 1); */
void quickSort(int arr[], int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(arr, lo, hi);
    quickSort(arr, lo, p - 1);
    quickSort(arr, p + 1, hi);
}`,
            codeEn: String.raw`/* splits arr[lo..hi]: smaller than the pivot to the left, the rest to the right; returns the pivot index */
int partition(int arr[], int lo, int hi) {
    int mid = lo + (hi - lo) / 2;
    int tmp = arr[mid];                 /* middle element as the pivot, moved to the end */
    arr[mid] = arr[hi];
    arr[hi] = tmp;

    int pivot = arr[hi];
    int store = lo;                     /* next place for an element smaller than the pivot */
    for (int i = lo; i < hi; i++) {
        if (arr[i] < pivot) {
            tmp = arr[i];
            arr[i] = arr[store];
            arr[store] = tmp;
            store++;
        }
    }
    tmp = arr[store];                   /* the pivot goes between the two parts */
    arr[store] = arr[hi];
    arr[hi] = tmp;
    return store;
}

/* call: quickSort(arr, 0, n - 1); */
void quickSort(int arr[], int lo, int hi) {
    if (lo >= hi) return;
    int p = partition(arr, lo, hi);
    quickSort(arr, lo, p - 1);
    quickSort(arr, p + 1, hi);
}`
        },
        {
            id: 'counting-sort', cat: 'Sortiranje / Sorting',
            hr: 'Sortiranje prebrojavanjem (counting sort)', en: 'Counting sort',
            dHr: 'Za cijele brojeve iz malog raspona (npr. ocjene 1-5 ili bodovi 0-100): O(n + k), gdje je k veličina raspona. Sve vrijednosti moraju biti od 0 do `MAX_VALUE`. Za silazno vrti petlju po `v` od `MAX_VALUE` prema 0.',
            dEn: 'For integers from a small range (e.g. grades 1-5 or points 0-100): O(n + k), where k is the size of the range. All values must be between 0 and `MAX_VALUE`. For descending order, run the `v` loop from `MAX_VALUE` down to 0.',
            tags: 'counting sort prebrojavanje brojanje sortiranje raspon range histogram ocjene grades', kind: 'toplevel', includes: [],
            code: String.raw`#define MAX_VALUE 100   /* sve vrijednosti moraju biti od 0 do MAX_VALUE */

void countingSort(int arr[], int n) {
    int count[MAX_VALUE + 1] = {0};
    for (int i = 0; i < n; i++) {
        count[arr[i]]++;                /* koliko se puta pojavljuje svaka vrijednost */
    }
    int k = 0;
    for (int v = 0; v <= MAX_VALUE; v++) {
        for (int c = 0; c < count[v]; c++) {
            arr[k++] = v;               /* v upiši count[v] puta */
        }
    }
}`,
            codeEn: String.raw`#define MAX_VALUE 100   /* all values must be between 0 and MAX_VALUE */

void countingSort(int arr[], int n) {
    int count[MAX_VALUE + 1] = {0};
    for (int i = 0; i < n; i++) {
        count[arr[i]]++;                /* how many times each value occurs */
    }
    int k = 0;
    for (int v = 0; v <= MAX_VALUE; v++) {
        for (int c = 0; c < count[v]; c++) {
            arr[k++] = v;               /* write v count[v] times */
        }
    }
}`
        },
        {
            id: 'qsort-int', cat: 'Sortiranje / Sorting',
            hr: 'qsort: cijeli i realni brojevi', en: 'qsort: integers and doubles',
            dHr: 'Poziv: `qsort(arr, n, sizeof(arr[0]), cmpIntAsc);`. Izraz `(x > y) - (x < y)` vraća -1, 0 ili 1 bez preljeva (za razliku od `x - y`).',
            dEn: 'Call: `qsort(arr, n, sizeof(arr[0]), cmpIntAsc);`. `(x > y) - (x < y)` returns -1, 0 or 1 without overflow (unlike `x - y`).',
            tags: 'qsort usporedba comparator sort sortiranje stdlib cmp', kind: 'toplevel', includes: ['stdlib.h'],
            code: String.raw`int cmpIntAsc(const void *a, const void *b) {
    int x = *(const int *) a;
    int y = *(const int *) b;
    return (x > y) - (x < y);      /* silazno: (x < y) - (x > y) */
}

int cmpDoubleAsc(const void *a, const void *b) {
    double x = *(const double *) a;
    double y = *(const double *) b;
    return (x > y) - (x < y);
}`
        },
        {
            id: 'qsort-str', cat: 'Sortiranje / Sorting',
            hr: 'qsort: znakovni nizovi', en: 'qsort: strings',
            dHr: 'Pazi koji oblik polja imaš. Za `char rijeci[N][MAX]`: `qsort(rijeci, n, sizeof(rijeci[0]), cmpStr2D);`. Za `char *rijeci[N]`: `qsort(rijeci, n, sizeof(char *), cmpStrPtr);`',
            dEn: 'Mind which kind of array you have. For `char words[N][MAX]`: `qsort(words, n, sizeof(words[0]), cmpStr2D);`. For `char *words[N]`: `qsort(words, n, sizeof(char *), cmpStrPtr);`',
            tags: 'qsort strcmp string rijeci abecedno alphabetical sort sortiranje', kind: 'toplevel', includes: ['stdlib.h', 'string.h'],
            code: String.raw`/* za char rijeci[N][MAX] */
int cmpStr2D(const void *a, const void *b) {
    return strcmp((const char *) a, (const char *) b);
}

/* za char *rijeci[N] (polje pokazivača) */
int cmpStrPtr(const void *a, const void *b) {
    return strcmp(*(char *const *) a, *(char *const *) b);
}`
        },
        {
            id: 'qsort-struct', cat: 'Sortiranje / Sorting',
            hr: 'qsort: strukture po više kriterija', en: 'qsort: structs by several keys',
            dHr: 'Silazno po bodovima, a kod jednakih abecedno po imenu. Poziv: `qsort(arr, n, sizeof(Student), cmpStudent);`',
            dEn: 'Descending by score, ties broken alphabetically by name. Call: `qsort(arr, n, sizeof(Student), cmpStudent);`',
            tags: 'qsort struct struktura kriterij sort sortiranje comparator', kind: 'toplevel', includes: ['stdlib.h', 'string.h'],
            code: String.raw`typedef struct {
    char name[50 + 1];
    double score;
} Student;

int cmpStudent(const void *a, const void *b) {
    const Student *x = a;
    const Student *y = b;
    if (x->score != y->score) return (x->score < y->score) - (x->score > y->score);
    return strcmp(x->name, y->name);
}`
        },

        // ---------------------------------------------------------------- Strings
        {
            id: 'fgets-line', cat: 'Nizovi / Strings',
            hr: 'Čitanje cijelog retka', en: 'Read a whole line',
            dHr: '`fgets` zadržava `\\n` pa ga treba maknuti. Nakon `scanf("%d", ...)` u ulazu ostaje `\\n`. Prije `fgets` ga pročitaj (npr. `getchar()`) ili koristi `scanf(" %100[^\\n]", line)`.',
            dEn: '`fgets` keeps the `\\n`, so strip it. After `scanf("%d", ...)` a `\\n` is left in the input. Read it first (e.g. `getchar()`) or use `scanf(" %100[^\\n]", line)`.',
            tags: 'fgets redak linija line string newline strcspn', kind: 'statements', includes: ['stdio.h', 'string.h'],
            code: String.raw`char line[100 + 1];
if (fgets(line, sizeof(line), stdin) != NULL) {
    line[strcspn(line, "\n")] = '\0';   /* makni '\n' s kraja */
}`
        },
        {
            id: 'string-funcs', cat: 'Nizovi / Strings',
            hr: 'Osnovne funkcije nad nizovima', en: 'Basic string functions',
            dHr: 'Duljina, obrtanje, velika slova, brojanje znaka. `ctype.h` funkcijama predaj `(unsigned char) c`.',
            dEn: 'Length, reverse, uppercase, count a character. Pass `(unsigned char) c` to `ctype.h` functions.',
            tags: 'strlen duljina obrni velika slova toupper count string niz znakova', kind: 'toplevel', includes: ['string.h', 'ctype.h'],
            code: String.raw`int myStrlen(const char *s) {
    int n = 0;
    while (s[n] != '\0') n++;
    return n;
}

void reverseString(char *s) {
    for (int i = 0, j = (int) strlen(s) - 1; i < j; i++, j--) {
        char t = s[i];
        s[i] = s[j];
        s[j] = t;
    }
}

void toUpperString(char *s) {
    for (; *s; s++) *s = (char) toupper((unsigned char) *s);
}

int countChar(const char *s, char c) {
    int n = 0;
    for (; *s; s++) {
        if (*s == c) n++;
    }
    return n;
}`
        },
        {
            id: 'string-compare', cat: 'Nizovi / Strings',
            hr: 'Usporedba nizova bez obzira na velika i mala slova', en: 'Case-insensitive string comparison',
            dHr: 'Vraća <0, 0 ili >0 kao `strcmp`, pa se može koristiti i za sortiranje. Druga funkcija uz to preskače razmake. `strcasecmp` nije dio C11 standarda i uz `-std=c11` nije deklariran.',
            dEn: 'Returns <0, 0 or >0 like `strcmp`, so it also works for sorting. The second function also skips spaces. `strcasecmp` is not part of C11 and is not declared with `-std=c11`.',
            tags: 'strcmp usporedba velika mala slova razmaci tolower case insensitive compare ignore spaces strcasecmp stricmp', kind: 'toplevel', includes: ['ctype.h'],
            code: String.raw`/* kao strcmp, ali 'A' i 'a' smatra jednakima */
int compareIgnoreCase(const char *s1, const char *s2) {
    while (*s1 != '\0' && tolower((unsigned char) *s1) == tolower((unsigned char) *s2)) {
        s1++;
        s2++;
    }
    return tolower((unsigned char) *s1) - tolower((unsigned char) *s2);
}

/* uz to preskače razmake: "Dobar dan" i "DOBARDAN" su jednaki */
int compareIgnoreSpacesCase(const char *s1, const char *s2) {
    for (;;) {
        while (*s1 == ' ') s1++;
        while (*s2 == ' ') s2++;
        int c1 = tolower((unsigned char) *s1);
        int c2 = tolower((unsigned char) *s2);
        if (c1 != c2 || c1 == '\0') return c1 - c2;
        s1++;
        s2++;
    }
}`,
            codeEn: String.raw`/* like strcmp, but treats 'A' and 'a' as equal */
int compareIgnoreCase(const char *s1, const char *s2) {
    while (*s1 != '\0' && tolower((unsigned char) *s1) == tolower((unsigned char) *s2)) {
        s1++;
        s2++;
    }
    return tolower((unsigned char) *s1) - tolower((unsigned char) *s2);
}

/* also skips spaces: "Good day" and "GOODDAY" are equal */
int compareIgnoreSpacesCase(const char *s1, const char *s2) {
    for (;;) {
        while (*s1 == ' ') s1++;
        while (*s2 == ' ') s2++;
        int c1 = tolower((unsigned char) *s1);
        int c2 = tolower((unsigned char) *s2);
        if (c1 != c2 || c1 == '\0') return c1 - c2;
        s1++;
        s2++;
    }
}`
        },
        {
            id: 'palindrome', cat: 'Nizovi / Strings',
            hr: 'Palindrom (niz znakova)', en: 'Palindrome (string)',
            dHr: 'Za provjeru bez razlike velikih i malih slova usporedi `tolower` oba znaka.',
            dEn: 'For a case-insensitive check, compare `tolower` of both characters.',
            tags: 'palindrom palindrome string niz', kind: 'toplevel', includes: ['string.h'],
            code: String.raw`int isPalindrome(const char *s) {
    int i = 0, j = (int) strlen(s) - 1;
    while (i < j) {
        if (s[i] != s[j]) return 0;
        i++;
        j--;
    }
    return 1;
}`
        },
        {
            id: 'count-words', cat: 'Nizovi / Strings',
            hr: 'Brojanje riječi', en: 'Count words',
            dHr: 'Riječ počinje kad nakon razmaka (ili na početku) dođe znak koji nije razmak.',
            dEn: 'A word starts when a non-space character follows a space (or the start).',
            tags: 'rijeci words count isspace brojanje', kind: 'toplevel', includes: ['ctype.h'],
            code: String.raw`int countWords(const char *s) {
    int count = 0, inWord = 0;
    for (; *s; s++) {
        if (isspace((unsigned char) *s)) {
            inWord = 0;
        } else if (!inWord) {
            inWord = 1;
            count++;
        }
    }
    return count;
}`
        },
        {
            id: 'char-classes', cat: 'Nizovi / Strings',
            hr: 'Brojanje slova, znamenki i razmaka', en: 'Count letters, digits and spaces',
            dHr: 'Pretpostavlja niz `s`. Funkcijama iz `ctype.h` predaj `unsigned char`. Za velika i mala slova posebno koristi `isupper` i `islower`.',
            dEn: 'Assumes a string `s`. Pass `unsigned char` to the `ctype.h` functions. To count upper- and lowercase letters separately, use `isupper` and `islower`.',
            tags: 'isalpha isdigit isspace isupper islower ctype slova znamenke razmaci brojanje count letters digits spaces klasifikacija', kind: 'statements', includes: ['stdio.h', 'ctype.h'],
            code: String.raw`int letters = 0, digits = 0, spaces = 0, others = 0;
for (int i = 0; s[i] != '\0'; i++) {
    unsigned char c = (unsigned char) s[i];
    if (isalpha(c)) letters++;
    else if (isdigit(c)) digits++;
    else if (isspace(c)) spaces++;
    else others++;
}
printf("Slova: %d, znamenke: %d, razmaci: %d, ostalo: %d\n", letters, digits, spaces, others);`,
            codeEn: String.raw`int letters = 0, digits = 0, spaces = 0, others = 0;
for (int i = 0; s[i] != '\0'; i++) {
    unsigned char c = (unsigned char) s[i];
    if (isalpha(c)) letters++;
    else if (isdigit(c)) digits++;
    else if (isspace(c)) spaces++;
    else others++;
}
printf("Letters: %d, digits: %d, spaces: %d, other: %d\n", letters, digits, spaces, others);`
        },
        {
            id: 'string-search', cat: 'Nizovi / Strings',
            hr: 'Traženje i brojanje podniza', en: 'Find and count a substring',
            dHr: '`strstr` vraća pokazivač na prvo pojavljivanje ili `NULL`, a indeks je razlika pokazivača `p - text`. Za jedan znak isto radi `strchr(text, c)`. Za brojanje s preklapanjem (`"aaa"` sadrži `"aa"` dvaput) pomakni se za 1 umjesto za `len`.',
            dEn: '`strstr` returns a pointer to the first occurrence or `NULL`, and the index is the pointer difference `p - text`. For a single character, `strchr(text, c)` works the same way. To count overlapping matches (`"aaa"` contains `"aa"` twice), advance by 1 instead of `len`.',
            tags: 'strstr strchr podniz rijec trazi pronadi broji pojavljivanja pozicija indeks substring find search count occurrences index position', kind: 'toplevel', includes: ['string.h'],
            code: String.raw`/* indeks prvog pojavljivanja word u text, ili -1 */
int findSubstring(const char *text, const char *word) {
    const char *p = strstr(text, word);
    return p != NULL ? (int) (p - text) : -1;
}

/* broj pojavljivanja word u text (bez preklapanja) */
int countSubstring(const char *text, const char *word) {
    int len = (int) strlen(word);
    int count = 0;
    if (len == 0) return 0;
    const char *p = strstr(text, word);
    while (p != NULL) {
        count++;
        p = strstr(p + len, word);      /* traži dalje iza pronađenog */
    }
    return count;
}`,
            codeEn: String.raw`/* index of the first occurrence of word in text, or -1 */
int findSubstring(const char *text, const char *word) {
    const char *p = strstr(text, word);
    return p != NULL ? (int) (p - text) : -1;
}

/* number of occurrences of word in text (non-overlapping) */
int countSubstring(const char *text, const char *word) {
    int len = (int) strlen(word);
    int count = 0;
    if (len == 0) return 0;
    const char *p = strstr(text, word);
    while (p != NULL) {
        count++;
        p = strstr(p + len, word);      /* keep searching after the match */
    }
    return count;
}`
        },
        {
            id: 'remove-char', cat: 'Nizovi / Strings',
            hr: 'Izbacivanje znakova iz niza', en: 'Remove characters from a string',
            dHr: 'Mijenja niz na mjestu: jedan indeks čita, a drugi upisuje samo znakove koje zadržavamo. `removeChar(s, \' \')` izbacuje razmake, a `removeChar(s, \'\\n\')` sve prijelaze u novi red. Za drugi uvjet (npr. zadrži samo slova) promijeni `if`. Radi nad poljem, ne nad literalom (`char *s = "..."`).',
            dEn: 'Modifies the string in place: one index reads, the other writes only the characters that are kept. `removeChar(s, \' \')` removes spaces, `removeChar(s, \'\\n\')` removes all newlines. For another rule (e.g. keep only letters) change the `if`. Works on an array, not on a string literal (`char *s = "..."`).',
            tags: 'izbaci obrisi makni ukloni znak razmake razmak bjeline remove delete strip spaces whitespace char filter', kind: 'toplevel', includes: ['ctype.h'],
            code: String.raw`/* izbacuje sve znakove c iz niza s */
void removeChar(char s[], char c) {
    int writeIdx = 0;
    for (int readIdx = 0; s[readIdx] != '\0'; readIdx++) {
        if (s[readIdx] != c) {
            s[writeIdx] = s[readIdx];   /* ovaj znak zadržavamo */
            writeIdx++;
        }
    }
    s[writeIdx] = '\0';
}

/* izbacuje sve bjeline: razmake, tabulatore i '\n' */
void removeWhitespace(char s[]) {
    int writeIdx = 0;
    for (int readIdx = 0; s[readIdx] != '\0'; readIdx++) {
        if (!isspace((unsigned char) s[readIdx])) {
            s[writeIdx] = s[readIdx];
            writeIdx++;
        }
    }
    s[writeIdx] = '\0';
}`,
            codeEn: String.raw`/* removes every character c from s */
void removeChar(char s[], char c) {
    int writeIdx = 0;
    for (int readIdx = 0; s[readIdx] != '\0'; readIdx++) {
        if (s[readIdx] != c) {
            s[writeIdx] = s[readIdx];   /* keep this character */
            writeIdx++;
        }
    }
    s[writeIdx] = '\0';
}

/* removes all whitespace: spaces, tabs and '\n' */
void removeWhitespace(char s[]) {
    int writeIdx = 0;
    for (int readIdx = 0; s[readIdx] != '\0'; readIdx++) {
        if (!isspace((unsigned char) s[readIdx])) {
            s[writeIdx] = s[readIdx];
            writeIdx++;
        }
    }
    s[writeIdx] = '\0';
}`
        },
        {
            id: 'str-convert', cat: 'Nizovi / Strings',
            hr: 'Pretvorbe broj ↔ niz znakova', en: 'Number ↔ string conversion',
            dHr: '`strtol`/`strtod` javljaju gdje su stali (drugi argument), `atoi`/`atof` ne prijavljuju greške.',
            dEn: '`strtol`/`strtod` report where they stopped (second argument); `atoi`/`atof` don\'t report errors.',
            tags: 'atoi atof strtol strtod sprintf snprintf sscanf pretvorba convert', kind: 'statements', includes: ['stdio.h', 'stdlib.h'],
            code: String.raw`int v = atoi("123");
double d = atof("3.14");
long hex = strtol("1F", NULL, 16);     /* 31 */

char buf[32];
snprintf(buf, sizeof buf, "%d", v);    /* broj -> niz */

int a, b;
sscanf("12;34", "%d;%d", &a, &b);      /* čitanje iz niza */`
        },
        {
            id: 'strdup', cat: 'Nizovi / Strings',
            hr: 'Kopija niza na gomili (strdup)', en: 'Heap copy of a string (strdup)',
            dHr: '`strdup` nije dio C11 standarda i uz `-std=c11` nije deklariran, pa ga napiši sam.',
            dEn: '`strdup` is not part of C11 and is not declared with `-std=c11`, so write your own.',
            tags: 'strdup kopija malloc strcpy string copy', kind: 'toplevel', includes: ['stdlib.h', 'string.h'],
            code: String.raw`char *copyString(const char *s) {
    char *p = malloc(strlen(s) + 1);
    if (p != NULL) strcpy(p, s);
    return p;
}`
        },

        // ---------------------------------------------------------------- Matrices
        {
            id: 'matrix-io', cat: 'Matrice / Matrices',
            hr: 'Učitavanje i ispis matrice', en: 'Read and print a matrix',
            dHr: 'Kod dvodimenzionalnog polja kao parametra moraju se navesti sve dimenzije osim prve.',
            dEn: 'For a 2D array parameter, every dimension except the first must be given.',
            tags: 'matrica 2d dvodimenzionalno polje matrix read print', kind: 'toplevel', includes: ['stdio.h'],
            code: String.raw`#define MAXN 10

void readMatrix(int m[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++)
        for (int j = 0; j < cols; j++)
            scanf("%d", &m[i][j]);
}

void printMatrix(int m[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++)
            printf("%4d", m[i][j]);
        printf("\n");
    }
}`
        },
        {
            id: 'matrix-ops', cat: 'Matrice / Matrices',
            hr: 'Dijagonale i transponiranje', en: 'Diagonals and transpose',
            dHr: 'Glavna dijagonala: `i == j`; sporedna: `i + j == n - 1`; iznad glavne: `i < j`.',
            dEn: 'Main diagonal: `i == j`; anti-diagonal: `i + j == n - 1`; above main: `i < j`.',
            tags: 'dijagonala sporedna glavna transponiranje matrica diagonal transpose', kind: 'statements', includes: [],
            code: String.raw`int mainDiag = 0, antiDiag = 0;
for (int i = 0; i < n; i++) {
    mainDiag += m[i][i];
    antiDiag += m[i][n - 1 - i];
}

/* transponiranje kvadratne matrice na mjestu */
for (int i = 0; i < n; i++) {
    for (int j = i + 1; j < n; j++) {
        int t = m[i][j];
        m[i][j] = m[j][i];
        m[j][i] = t;
    }
}`
        },
        {
            id: 'matrix-rotate', cat: 'Matrice / Matrices',
            hr: 'Rotacija i transponiranje u novu matricu', en: 'Rotate and transpose into a new matrix',
            dHr: 'Radi i za pravokutne matrice: ako je `src` dimenzija rows × cols, `dest` je cols × rows. `dest` mora biti druga matrica. Rotacija za 180° su dvije rotacije udesno. Ako već imaš `#define MAXN` s drugom vrijednošću, obriši ovaj.',
            dEn: 'Works for rectangular matrices too: if `src` is rows × cols, `dest` is cols × rows. `dest` must be a different matrix. A 180° rotation is two right rotations. If you already have a `#define MAXN` with a different value, delete this one.',
            tags: 'rotacija rotiraj zakreni 90 stupnjeva matrica transponiraj transponirana rotate transpose matrix clockwise', kind: 'toplevel', includes: [],
            code: String.raw`#define MAXN 10

/* za 90° udesno (u smjeru kazaljke na satu); src je rows x cols, dest postaje cols x rows */
void rotateMatrixRight(int src[][MAXN], int dest[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[j][rows - 1 - i] = src[i][j];
        }
    }
}

/* za 90° ulijevo (suprotno od kazaljke na satu) */
void rotateMatrixLeft(int src[][MAXN], int dest[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[cols - 1 - j][i] = src[i][j];
        }
    }
}

/* transponirana matrica: retci postaju stupci */
void transposeMatrix(int src[][MAXN], int dest[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[j][i] = src[i][j];
        }
    }
}`,
            codeEn: String.raw`#define MAXN 10

/* 90° to the right (clockwise); src is rows x cols, dest becomes cols x rows */
void rotateMatrixRight(int src[][MAXN], int dest[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[j][rows - 1 - i] = src[i][j];
        }
    }
}

/* 90° to the left (counter-clockwise) */
void rotateMatrixLeft(int src[][MAXN], int dest[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[cols - 1 - j][i] = src[i][j];
        }
    }
}

/* transposed matrix: rows become columns */
void transposeMatrix(int src[][MAXN], int dest[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            dest[j][i] = src[i][j];
        }
    }
}`
        },
        {
            id: 'matrix-multiply', cat: 'Matrice / Matrices',
            hr: 'Zbroj i umnožak matrica', en: 'Matrix sum and product',
            dHr: 'Umnožak postoji samo ako je broj stupaca od `a` jednak broju redaka od `b`. Rezultat `c` mora biti treća matrica (ne `a` ni `b`). Za razliku zamijeni `+` s `-`. Ako već imaš `#define MAXN` s drugom vrijednošću, obriši ovaj.',
            dEn: 'The product exists only if the number of columns of `a` equals the number of rows of `b`. The result `c` must be a third matrix (neither `a` nor `b`). For the difference, replace `+` with `-`. If you already have a `#define MAXN` with a different value, delete this one.',
            tags: 'mnozenje matrica umnozak zbroj zbrajanje razlika matrix multiply multiplication product sum add', kind: 'toplevel', includes: [],
            code: String.raw`#define MAXN 10

/* c = a + b; sve tri su rows x cols */
void addMatrices(int a[][MAXN], int b[][MAXN], int c[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            c[i][j] = a[i][j] + b[i][j];
        }
    }
}

/* c = a * b; a je rowsA x colsA, b je colsA x colsB, c postaje rowsA x colsB */
void multiplyMatrices(int a[][MAXN], int b[][MAXN], int c[][MAXN], int rowsA, int colsA, int colsB) {
    for (int i = 0; i < rowsA; i++) {
        for (int j = 0; j < colsB; j++) {
            c[i][j] = 0;
            for (int k = 0; k < colsA; k++) {
                c[i][j] += a[i][k] * b[k][j];   /* redak i od a puta stupac j od b */
            }
        }
    }
}`,
            codeEn: String.raw`#define MAXN 10

/* c = a + b; all three are rows x cols */
void addMatrices(int a[][MAXN], int b[][MAXN], int c[][MAXN], int rows, int cols) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            c[i][j] = a[i][j] + b[i][j];
        }
    }
}

/* c = a * b; a is rowsA x colsA, b is colsA x colsB, c becomes rowsA x colsB */
void multiplyMatrices(int a[][MAXN], int b[][MAXN], int c[][MAXN], int rowsA, int colsA, int colsB) {
    for (int i = 0; i < rowsA; i++) {
        for (int j = 0; j < colsB; j++) {
            c[i][j] = 0;
            for (int k = 0; k < colsA; k++) {
                c[i][j] += a[i][k] * b[k][j];   /* row i of a times column j of b */
            }
        }
    }
}`
        },
        {
            id: 'matrix-check', cat: 'Matrice / Matrices',
            hr: 'Provjera: simetrična i jedinična matrica', en: 'Check: symmetric and identity matrix',
            dHr: 'Funkcija vraća 0 čim nađe element koji ne zadovoljava uvjet, a 1 ako takvog nema. Isti obrazac vrijedi za druge provjere (npr. gornja trokutasta: svi elementi s `i > j` su 0). Ako već imaš `#define MAXN` s drugom vrijednošću, obriši ovaj.',
            dEn: 'The function returns 0 as soon as it finds an element that breaks the rule, and 1 if there is none. The same pattern works for other checks (e.g. upper triangular: every element with `i > j` is 0). If you already have a `#define MAXN` with a different value, delete this one.',
            tags: 'simetricna jedinicna matrica provjera svojstvo symmetric identity matrix check property trokutasta triangular', kind: 'toplevel', includes: [],
            code: String.raw`#define MAXN 10

int isSymmetric(int m[][MAXN], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {       /* dovoljno je gledati iznad dijagonale */
            if (m[i][j] != m[j][i]) return 0;
        }
    }
    return 1;
}

int isIdentity(int m[][MAXN], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            int expected = (i == j) ? 1 : 0;    /* 1 na glavnoj dijagonali, inače 0 */
            if (m[i][j] != expected) return 0;
        }
    }
    return 1;
}`,
            codeEn: String.raw`#define MAXN 10

int isSymmetric(int m[][MAXN], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = i + 1; j < n; j++) {       /* checking above the diagonal is enough */
            if (m[i][j] != m[j][i]) return 0;
        }
    }
    return 1;
}

int isIdentity(int m[][MAXN], int n) {
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            int expected = (i == j) ? 1 : 0;    /* 1 on the main diagonal, 0 elsewhere */
            if (m[i][j] != expected) return 0;
        }
    }
    return 1;
}`
        },

        // ---------------------------------------------------------------- Structs
        {
            id: 'struct-def', cat: 'Strukture / Structs',
            hr: 'Struktura s typedef', en: 'Struct with typedef',
            dHr: 'Članovima se pristupa s `.` (varijabla) ili `->` (pokazivač). Za niz od 30 znakova treba `[30 + 1]` zbog `\'\\0\'`.',
            dEn: 'Access members with `.` (variable) or `->` (pointer). A 30-character string needs `[30 + 1]` for the `\'\\0\'`.',
            tags: 'struct struktura typedef zapis record', kind: 'toplevel', includes: [],
            code: String.raw`typedef struct {
    int id;
    char name[30 + 1];
    double price;
} Item;`
        },
        {
            id: 'struct-init', cat: 'Strukture / Structs',
            hr: 'Inicijalizacija i kopiranje strukture', en: 'Initialize and copy a struct',
            dHr: 'Pretpostavlja `Item` iz isječka "Struktura s typedef". Niz u strukturi puni se sa `strcpy`, a ne s `=`. Cijela struktura može se pridružiti s `=`, ali se ne može uspoređivati s `==` (usporedi član po član).',
            dEn: 'Assumes `Item` from the "Struct with typedef" snippet. A string member is filled with `strcpy`, not `=`. A whole struct can be assigned with `=`, but it can\'t be compared with `==` (compare member by member).',
            tags: 'struct struktura inicijalizacija initialize init kopiranje copy pridruzivanje assign strcpy designated', kind: 'statements', includes: ['string.h'],
            code: String.raw`Item a = {1, "Olovka", 2.50};                  /* redom kao u definiciji */
Item b = {.id = 2, .price = 1.20};             /* po imenu člana; ostali su 0 */
Item c = {0};                                  /* svi članovi 0 */
Item shop[] = {{1, "Olovka", 2.50}, {2, "Gumica", 1.20}};
int count = sizeof shop / sizeof shop[0];      /* 2 */

strcpy(b.name, "Gumica");                      /* niz se puni sa strcpy, ne s = */
c = a;                                         /* kopira cijelu strukturu, i niz u njoj */`,
            codeEn: String.raw`Item a = {1, "Pencil", 2.50};                  /* in the order of the definition */
Item b = {.id = 2, .price = 1.20};             /* by member name; the rest are 0 */
Item c = {0};                                  /* all members 0 */
Item shop[] = {{1, "Pencil", 2.50}, {2, "Eraser", 1.20}};
int count = sizeof shop / sizeof shop[0];      /* 2 */

strcpy(b.name, "Eraser");                      /* fill a string with strcpy, not = */
c = a;                                         /* copies the whole struct, its string too */`
        },
        {
            id: 'struct-read', cat: 'Strukture / Structs',
            hr: 'Učitavanje polja struktura', en: 'Read an array of structs',
            dHr: 'Pretpostavlja `Item` iz isječka "Struktura s typedef". Širina `%30s` sprječava pisanje izvan polja.',
            dEn: 'Assumes `Item` from the "Struct with typedef" snippet. The width in `%30s` prevents overflowing the array.',
            tags: 'struct struktura polje scanf ucitavanje read', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`Item items[100];
int n = 0;
while (n < 100 && scanf("%d %30s %lf", &items[n].id, items[n].name, &items[n].price) == 3) {
    n++;
}
for (int i = 0; i < n; i++) {
    printf("%d %s %.2f\n", items[i].id, items[i].name, items[i].price);
}`
        },
        {
            id: 'struct-search', cat: 'Strukture / Structs',
            hr: 'Traženje u polju struktura', en: 'Search an array of structs',
            dHr: 'Pretpostavlja `Item` iz isječka "Struktura s typedef". Funkcije vraćaju indeks (ili -1), pa pozivatelj može i mijenjati pronađeni zapis: `items[i].price = 0;`. Nizove uspoređuj sa `strcmp`.',
            dEn: 'Assumes `Item` from the "Struct with typedef" snippet. The functions return an index (or -1), so the caller can also modify the found record: `items[i].price = 0;`. Compare strings with `strcmp`.',
            tags: 'struct struktura trazi pronadi sifra ime najveci najskuplji search find id name max', kind: 'toplevel', includes: ['string.h'],
            code: String.raw`/* indeks zapisa sa šifrom id, ili -1 */
int findById(const Item arr[], int n, int id) {
    for (int i = 0; i < n; i++) {
        if (arr[i].id == id) return i;
    }
    return -1;
}

/* indeks zapisa s imenom name, ili -1 */
int findByName(const Item arr[], int n, const char *name) {
    for (int i = 0; i < n; i++) {
        if (strcmp(arr[i].name, name) == 0) return i;
    }
    return -1;
}

/* indeks najskupljeg zapisa (n > 0) */
int indexOfMaxPrice(const Item arr[], int n) {
    int best = 0;
    for (int i = 1; i < n; i++) {
        if (arr[i].price > arr[best].price) best = i;
    }
    return best;
}`,
            codeEn: String.raw`/* index of the record with this id, or -1 */
int findById(const Item arr[], int n, int id) {
    for (int i = 0; i < n; i++) {
        if (arr[i].id == id) return i;
    }
    return -1;
}

/* index of the record with this name, or -1 */
int findByName(const Item arr[], int n, const char *name) {
    for (int i = 0; i < n; i++) {
        if (strcmp(arr[i].name, name) == 0) return i;
    }
    return -1;
}

/* index of the most expensive record (n > 0) */
int indexOfMaxPrice(const Item arr[], int n) {
    int best = 0;
    for (int i = 1; i < n; i++) {
        if (arr[i].price > arr[best].price) best = i;
    }
    return best;
}`
        },
        {
            id: 'struct-sort', cat: 'Strukture / Structs',
            hr: 'Sortiranje polja struktura bez qsort', en: 'Sort an array of structs without qsort',
            dHr: 'Pretpostavlja `Item` iz isječka "Struktura s typedef". Bubble sort koji zamjenjuje cijele strukture. Poredak određuje `comesAfter`: silazno po cijeni, a kod jednake cijene abecedno po imenu. Za drugi poredak mijenjaj samo nju.',
            dEn: 'Assumes `Item` from the "Struct with typedef" snippet. A bubble sort that swaps whole structs. The order is defined by `comesAfter`: descending by price, ties alphabetically by name. For a different order, change only that function.',
            tags: 'struct struktura sortiranje sort bubble kriterij criteria vise kriterija zamjena swap', kind: 'toplevel', includes: ['string.h'],
            code: String.raw`/* 1 ako a mora doći iza b: silazno po cijeni, kod jednake cijene abecedno po imenu */
int comesAfter(const Item *a, const Item *b) {
    if (a->price != b->price) return a->price < b->price;
    return strcmp(a->name, b->name) > 0;
}

void sortItems(Item arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (comesAfter(&arr[j], &arr[j + 1])) {
                Item tmp = arr[j];              /* zamjena cijelih struktura */
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
            }
        }
    }
}`,
            codeEn: String.raw`/* 1 if a must come after b: descending by price, equal prices alphabetically by name */
int comesAfter(const Item *a, const Item *b) {
    if (a->price != b->price) return a->price < b->price;
    return strcmp(a->name, b->name) > 0;
}

void sortItems(Item arr[], int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (comesAfter(&arr[j], &arr[j + 1])) {
                Item tmp = arr[j];              /* swap whole structs */
                arr[j] = arr[j + 1];
                arr[j + 1] = tmp;
            }
        }
    }
}`
        },
        {
            id: 'struct-pointer', cat: 'Strukture / Structs',
            hr: 'Struktura kao parametar funkcije (->)', en: 'Struct as a function parameter (->)',
            dHr: 'Pretpostavlja `Item` iz isječka "Struktura s typedef". Funkcija koja dobije strukturu po vrijednosti mijenja kopiju. Za izmjenu predaj adresu: `raisePrice(&items[i], 10.0);`. `const` označava da funkcija samo čita.',
            dEn: 'Assumes `Item` from the "Struct with typedef" snippet. A function that receives a struct by value modifies a copy. To change it, pass its address: `raisePrice(&items[i], 10.0);`. `const` marks that the function only reads.',
            tags: 'struct struktura pokazivac pointer strelica arrow -> funkcija parametar const izmjena modify', kind: 'toplevel', includes: ['stdio.h'],
            code: String.raw`/* const: funkcija samo čita zapis */
void printItem(const Item *it) {
    printf("%d %s %.2f\n", it->id, it->name, it->price);
}

/* mijenja zapis pozivatelja; poziv: raisePrice(&items[i], 10.0); */
void raisePrice(Item *it, double percent) {
    it->price = it->price * (1.0 + percent / 100.0);
}`,
            codeEn: String.raw`/* const: the function only reads the record */
void printItem(const Item *it) {
    printf("%d %s %.2f\n", it->id, it->name, it->price);
}

/* changes the caller's record; call: raisePrice(&items[i], 10.0); */
void raisePrice(Item *it, double percent) {
    it->price = it->price * (1.0 + percent / 100.0);
}`
        },

        // ---------------------------------------------------------------- Memory
        {
            id: 'malloc-array', cat: 'Memorija / Memory',
            hr: 'Dinamičko polje (malloc / free)', en: 'Dynamic array (malloc / free)',
            dHr: 'Uvijek provjeri vraća li `malloc` `NULL`. Nakon `free` postavi pokazivač na `NULL`. `calloc(n, sizeof *arr)` radi isto, ali sve elemente postavi na 0.',
            dEn: 'Always check whether `malloc` returned `NULL`. Set the pointer to `NULL` after `free`. `calloc(n, sizeof *arr)` does the same but also sets every element to 0.',
            tags: 'malloc free dinamicko polje heap gomila memorija dynamic memory', kind: 'statements', includes: ['stdio.h', 'stdlib.h'],
            code: String.raw`int n;
scanf("%d", &n);
int *arr = malloc(n * sizeof *arr);
if (arr == NULL) {
    printf("Nema dovoljno memorije\n");
    return 1;
}
/* ... koristi arr[0] .. arr[n - 1] ... */
free(arr);
arr = NULL;`
        },
        {
            id: 'realloc-grow', cat: 'Memorija / Memory',
            hr: 'Polje koje raste (realloc)', en: 'Growing array (realloc)',
            dHr: 'Rezultat `realloc` spremi u privremeni pokazivač: ako vrati `NULL`, stari blok i dalje vrijedi.',
            dEn: 'Store the result of `realloc` in a temporary pointer: if it returns `NULL`, the old block is still valid.',
            tags: 'realloc dinamicko polje raste kapacitet grow capacity', kind: 'statements', includes: ['stdio.h', 'stdlib.h'],
            code: String.raw`int cap = 4, n = 0, x;
int *arr = malloc(cap * sizeof *arr);
while (arr != NULL && scanf("%d", &x) == 1) {
    if (n == cap) {
        int *tmp = realloc(arr, 2 * cap * sizeof *arr);
        if (tmp == NULL) break;
        arr = tmp;
        cap *= 2;
    }
    arr[n++] = x;
}
/* ... */
free(arr);`
        },
        {
            id: 'malloc-2d', cat: 'Memorija / Memory',
            hr: 'Dinamička matrica', en: 'Dynamic matrix',
            dHr: 'Polje pokazivača na retke. Oslobađa se obrnutim redoslijedom: prvo reci, pa polje pokazivača.',
            dEn: 'An array of row pointers. Free in reverse order: rows first, then the pointer array.',
            tags: 'malloc matrica 2d dinamicka free dynamic matrix', kind: 'statements', includes: ['stdlib.h'],
            code: String.raw`int **m = malloc(rows * sizeof *m);
for (int i = 0; i < rows; i++) {
    m[i] = malloc(cols * sizeof *m[i]);
}
/* ... m[i][j] ... */
for (int i = 0; i < rows; i++) free(m[i]);
free(m);`
        },

        // ---------------------------------------------------------------- Files
        {
            id: 'file-text-read', cat: 'Datoteke / Files',
            hr: 'Čitanje tekstualne datoteke', en: 'Read a text file',
            dHr: 'Čitaj dok `fscanf` vraća očekivani broj vrijednosti. Ne koristi `while (!feof(f))`.',
            dEn: 'Read while `fscanf` returns the expected count. Don\'t use `while (!feof(f))`.',
            tags: 'fopen fscanf fclose datoteka tekstualna citanje file text read', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`FILE *f = fopen("ulaz.txt", "r");
if (f == NULL) {
    printf("Ne mogu otvoriti datoteku\n");
    return 1;
}
int id;
char name[50 + 1];
double value;
while (fscanf(f, "%d %50s %lf", &id, name, &value) == 3) {
    /* obradi jedan zapis */
}
fclose(f);`
        },
        {
            id: 'file-text-sep', cat: 'Datoteke / Files',
            hr: 'Retci s razdjelnikom (npr. ;)', en: 'Lines with a separator (e.g. ;)',
            dHr: '`%50[^;]` čita sve do `;` (pa i razmake). Čitanje retka s `fgets` i `sscanf` lakše preskače neispravne retke.',
            dEn: '`%50[^;]` reads everything up to `;` (spaces included). Reading lines with `fgets` and `sscanf` makes skipping bad lines easier.',
            tags: 'csv razdjelnik separator tocka zarez fgets sscanf datoteka file', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`char line[256];
while (fgets(line, sizeof line, f) != NULL) {
    int id;
    char name[50 + 1];
    double value;
    if (sscanf(line, "%d;%50[^;];%lf", &id, name, &value) == 3) {
        /* ... */
    }
}`
        },
        {
            id: 'file-text-write', cat: 'Datoteke / Files',
            hr: 'Pisanje u tekstualnu datoteku', en: 'Write a text file',
            dHr: '`"w"` briše postojeći sadržaj, a `"a"` dodaje na kraj.',
            dEn: '`"w"` erases existing content; `"a"` appends to the end.',
            tags: 'fopen fprintf fclose pisanje zapis write datoteka file', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`FILE *out = fopen("izlaz.txt", "w");
if (out == NULL) {
    printf("Ne mogu otvoriti datoteku\n");
    return 1;
}
for (int i = 0; i < n; i++) {
    fprintf(out, "%d;%s;%.2f\n", items[i].id, items[i].name, items[i].price);
}
fclose(out);`
        },
        {
            id: 'file-bin', cat: 'Datoteke / Files',
            hr: 'Binarna datoteka: pisanje i čitanje', en: 'Binary file: write and read',
            dHr: 'Zapisi se spremaju točno kako su u memoriji. Pretpostavlja `Item` iz isječka "Struktura s typedef". Cijela datoteka odjednom: `n = fread(items, sizeof(Item), MAX, f);` vraća broj pročitanih zapisa.',
            dEn: 'Records are stored exactly as they are in memory. Assumes `Item` from the "Struct with typedef" snippet. Whole file at once: `n = fread(items, sizeof(Item), MAX, f);` returns the number of records read.',
            tags: 'binarna datoteka fwrite fread rb wb binary file record zapis', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`FILE *f = fopen("podaci.bin", "wb");
fwrite(items, sizeof(Item), n, f);        /* n zapisa iz polja */
fclose(f);

f = fopen("podaci.bin", "rb");
Item it;
while (fread(&it, sizeof(Item), 1, f) == 1) {
    /* obradi zapis it */
}
fclose(f);`
        },
        {
            id: 'file-bin-seek', cat: 'Datoteke / Files',
            hr: 'Binarna datoteka: izravan pristup (fseek)', en: 'Binary file: random access (fseek)',
            dHr: 'Za izmjenu na mjestu otvori s `"r+b"`. Između čitanja i pisanja mora doći `fseek` (ili `fflush`). Ako je šifra zapisa njegova pozicija, zapis k je na mjestu `k - 1`.',
            dEn: 'Open with `"r+b"` to update in place. A `fseek` (or `fflush`) is required between reading and writing. If a record\'s id is its position, record k is at index `k - 1`.',
            tags: 'fseek ftell seek_set seek_end r+b izmjena update binarna datoteka random access', kind: 'statements', includes: ['stdio.h'],
            code: String.raw`FILE *f = fopen("podaci.bin", "r+b");
Item it;

/* broj zapisa u datoteci */
fseek(f, 0L, SEEK_END);
long count = ftell(f) / (long) sizeof(Item);

/* čitanje zapisa s indeksom k (od 0) */
fseek(f, k * (long) sizeof(Item), SEEK_SET);
fread(&it, sizeof(Item), 1, f);

/* izmjena tog istog zapisa */
it.price *= 1.1;
fseek(f, k * (long) sizeof(Item), SEEK_SET);
fwrite(&it, sizeof(Item), 1, f);
fclose(f);`
        },

        // ---------------------------------------------------------------- Recursion
        {
            id: 'recursion', cat: 'Rekurzija / Recursion',
            hr: 'Primjeri rekurzije', en: 'Recursion examples',
            dHr: 'Svaka rekurzija treba osnovni slučaj koji je zaustavlja i korak koji smanjuje problem.',
            dEn: 'Every recursion needs a base case that stops it and a step that makes the problem smaller.',
            tags: 'rekurzija recursion potencija power zbroj binarno', kind: 'toplevel', includes: [],
            code: String.raw`int sumArrayRec(const int arr[], int n) {
    return n == 0 ? 0 : arr[n - 1] + sumArrayRec(arr, n - 1);
}

double power(double x, int n) {          /* x^n za n >= 0 */
    if (n == 0) return 1.0;
    double half = power(x, n / 2);
    return n % 2 == 0 ? half * half : half * half * x;
}

int binarySearchRec(const int arr[], int lo, int hi, int key) {
    if (lo > hi) return -1;
    int mid = lo + (hi - lo) / 2;
    if (arr[mid] == key) return mid;
    return arr[mid] < key ? binarySearchRec(arr, mid + 1, hi, key)
                          : binarySearchRec(arr, lo, mid - 1, key);
}`
        }
    ];

    // ------------------------------------------------------------------ Reference tables
    // In table cells, {{hrvatski|English}} is shown in the selected language only.
    const reference = [
        {
            id: 'types', hr: 'Tipovi podataka i rasponi', en: 'Data types and ranges',
            tags: 'int char short long float double raspon range sizeof limits bajt byte velicina size',
            noteHr: 'Veličine ovise o implementaciji. Ovdje su za gcc na 64-bitnom Linuxu (Edgar); provjeri sa `sizeof`. Konstante su u `<limits.h>` (`INT_MAX`, `INT_MIN`, `LLONG_MAX`...) i `<float.h>` (`FLT_MAX`, `DBL_EPSILON`, `FLT_DIG`...).',
            noteEn: 'Sizes are implementation-defined. These are for gcc on 64-bit Linux (Edgar); check with `sizeof`. Constants live in `<limits.h>` (`INT_MAX`, `INT_MIN`, `LLONG_MAX`...) and `<float.h>` (`FLT_MAX`, `DBL_EPSILON`, `FLT_DIG`...).',
            cols: ['{{Tip|Type}}', 'B', '{{Raspon|Range}}', 'printf', 'scanf'],
            rows: [
                ['`char`', '1', '-128 … 127 ({{signed na gcc x86|signed on gcc x86}})', '`%c` `%hhd`', '`%c`'],
                ['`unsigned char`', '1', '0 … 255', '`%c` `%hhu`', '`%c` `%hhu`'],
                ['`short`', '2', '-32 768 … 32 767', '`%hd`', '`%hd`'],
                ['`unsigned short`', '2', '0 … 65 535', '`%hu`', '`%hu`'],
                ['`int`', '4', '-2 147 483 648 … 2 147 483 647', '`%d`', '`%d`'],
                ['`unsigned int`', '4', '0 … 4 294 967 295', '`%u`', '`%u`'],
                ['`long`', '8', '≈ ±9.22·10^18 ({{na Windowsima 4 B|4 B on Windows}})', '`%ld`', '`%ld`'],
                ['`long long`', '8', '-9 223 372 036 854 775 808 … 9 223 372 036 854 775 807', '`%lld`', '`%lld`'],
                ['`unsigned long long`', '8', '0 … 18 446 744 073 709 551 615', '`%llu`', '`%llu`'],
                ['`_Bool`', '1', '{{0 ili 1|0 or 1}}', '`%d`', '-'],
                ['`float`', '4', '±1.18·10^-38 … ±3.40·10^38, ~6-7 {{znamenki|digits}}', '`%f` `%e` `%g`', '`%f`'],
                ['`double`', '8', '±2.23·10^-308 … ±1.80·10^308, ~15-16 {{znamenki|digits}}', '`%f` `%lf` `%e` `%g`', '`%lf`'],
                ['`long double`', '16', '±3.36·10^-4932 … ±1.19·10^4932, ~18-19 {{znamenki (80-bitni x87)|digits (80-bit x87)}}', '`%Lf`', '`%Lf`'],
                ['{{pokazivač|pointer}}', '8', '{{adresa|address}}', '`%p`', '-'],
                ['`size_t` (sizeof)', '8', '0 … 2^64 - 1', '`%zu`', '`%zu`']
            ]
        },
        {
            id: 'ieee754', hr: 'IEEE 754: realni brojevi', en: 'IEEE 754: floating point',
            tags: 'ieee 754 float double mantisa mantissa karakteristika eksponent exponent bias pomak denormalizirani subnormal nan beskonacno infinity preciznost precision epsilon',
            noteHr: 'Normalizirani broj: (-1)^s · 1.m · 2^(K - pomak), gdje je K karakteristika (pohranjeni eksponent). K = 0: nula ili denormalizirani broj 0.m · 2^(1 - pomak). K = sve jedinice: m = 0 daje ±∞, m ≠ 0 daje NaN. Postupak: predznak, binarni zapis cijelog i razlomljenog dijela, normalizacija na 1.xxx · 2^e, K = e + pomak, mantisa su bitovi iza vodeće jedinice. Primjeri: 1.0f = `0x3F800000`, -2.5f = `0xC0200000`. 0.1 nije točno prikaziv.',
            noteEn: 'Normal number: (-1)^s · 1.m · 2^(E - bias), where E is the stored (biased) exponent. E = 0: zero or subnormal 0.m · 2^(1 - bias). E = all ones: m = 0 gives ±∞, m ≠ 0 gives NaN. Steps: sign, binary of the integer and fraction parts, normalize to 1.xxx · 2^e, E = e + bias, mantissa = bits after the leading 1. Examples: 1.0f = `0x3F800000`, -2.5f = `0xC0200000`. 0.1 is not exactly representable.',
            cols: ['', 'float', 'double'],
            rows: [
                ['{{Ukupno bitova|Total bits}}', '32', '64'],
                ['{{Predznak|Sign}}', '1', '1'],
                ['{{Karakteristika|Exponent}}', '8 ({{pomak|bias}} 127)', '11 ({{pomak|bias}} 1023)'],
                ['{{Mantisa|Mantissa}}', '23 (+1 {{skriveni bit|hidden bit}})', '52 (+1 {{skriveni bit|hidden bit}})'],
                ['{{Najmanji normalizirani|Smallest normal}}', '2^-126 ≈ 1.18·10^-38', '2^-1022 ≈ 2.23·10^-308'],
                ['{{Najmanji denormalizirani|Smallest subnormal}}', '2^-149 ≈ 1.40·10^-45', '2^-1074 ≈ 4.94·10^-324'],
                ['{{Najveći|Largest}}', '(2 - 2^-23)·2^127 ≈ 3.40·10^38', '(2 - 2^-52)·2^1023 ≈ 1.80·10^308'],
                ['{{Epsilon (razmak iza 1.0)|Epsilon (gap after 1.0)}}', '2^-23 ≈ 1.19·10^-7', '2^-52 ≈ 2.22·10^-16'],
                ['{{Svi cijeli brojevi točno do|All integers exact up to}}', '2^24 = 16 777 216', '2^53 ≈ 9.007·10^15'],
                ['{{Dekadske znamenke|Decimal digits}}', '6-7 (`FLT_DIG` = 6)', '15-16 (`DBL_DIG` = 15)']
            ]
        },
        {
            id: 'twos', hr: 'Cijeli brojevi: dvojni komplement', en: 'Integers: two\'s complement',
            tags: 'dvojni komplement twos complement negativni negative preljev overflow unsigned signed heksadekadski hex oktalni octal sufiks suffix literal',
            cols: ['{{Pravilo|Rule}}', '{{Primjer|Example}}'],
            rows: [
                ['-x = ~x + 1 ({{invertiraj bitove i dodaj 1|invert the bits and add 1}})', '{{8 bita|8 bits}}: 5 = `0000 0101`, -5 = `1111 1011`'],
                ['{{Raspon n bitova (signed)|n-bit range (signed)}}', '-2^(n-1) … 2^(n-1) - 1; {{8 bita|8 bits}}: -128 … 127'],
                ['{{Raspon n bitova (unsigned)|n-bit range (unsigned)}}', '0 … 2^n - 1; {{8 bita|8 bits}}: 0 … 255'],
                ['{{Posebne vrijednosti (8 bita)|Special values (8 bits)}}', '-1 = `1111 1111`, -128 = `1000 0000`, 127 = `0111 1111`'],
                ['{{unsigned preljev se "omata" modulo 2^n|unsigned arithmetic wraps around modulo 2^n}}', '`UINT_MAX + 1u == 0`'],
                ['{{signed preljev je nedefinirano ponašanje|signed overflow is undefined behaviour}}', '`INT_MAX + 1` → UB'],
                ['{{Negativan broj u unsigned tipu: vrijednost + 2^n|Negative value in an unsigned type: value + 2^n}}', '`(unsigned char) -1 == 255`'],
                ['{{Pomak udesno negativnog broja ovisi o implementaciji (gcc: aritmetički)|Right shift of a negative number is implementation-defined (gcc: arithmetic)}}', '`-8 >> 1 == -4` {{na gcc|on gcc}}'],
                ['{{Literali|Literals}}', '`0x1F` (hex), `017` ({{okt.|oct.}}), `10u`, `10L`, `10LL`, `1.5f`, `1.5L`, `\'A\'`']
            ]
        },
        {
            id: 'bit-tricks', hr: 'Bitovni trikovi', en: 'Bit tricks',
            tags: 'bit bitovi maska mask trik trick postavi obrisi invertiraj izdvoji set clear toggle extract najniza jedinica lowest set bit potencija power of two and or xor pomak shift',
            noteHr: 'Koristi `unsigned` tipove i `1u`. Pomak za cijelu širinu tipa ili više (npr. `1u << 32` za 32-bitni tip) je nedefinirano ponašanje. Bitovi se broje od 0 (najmanje značajan). Pazi na prioritet: `x & 1 == 0` znači `x & (1 == 0)`.',
            noteEn: 'Use `unsigned` types and `1u`. Shifting by the full width of the type or more (e.g. `1u << 32` for a 32-bit type) is undefined behaviour. Bits are numbered from 0 (least significant). Mind the precedence: `x & 1 == 0` means `x & (1 == 0)`.',
            cols: ['{{Izraz|Expression}}', '{{Značenje|Meaning}}', '{{Primjer|Example}}'],
            rows: [
                ['`(x >> k) & 1u`', '{{bit k (0 ili 1)|bit k (0 or 1)}}', '`(5 >> 2) & 1u` → 1'],
                ['`x | (1u << k)`', '{{postavi bit k na 1|set bit k to 1}}', '`5 | 2` → 7 (`101` → `111`)'],
                ['`x & ~(1u << k)`', '{{postavi bit k na 0|clear bit k}}', '`7 & ~2u` → 5'],
                ['`x ^ (1u << k)`', '{{invertiraj bit k|toggle bit k}}', '`5 ^ 2` → 7'],
                ['`x | m`, `x & ~m`, `x ^ m`', '{{postavi / obriši / invertiraj sve bitove maske m|set / clear / toggle all bits of mask m}}', '`5 | 10` → 15, `15 & ~10u` → 5'],
                ['`(1u << n) - 1`', '{{maska s n najnižih jedinica (n < 32)|mask of the n lowest bits (n < 32)}}', '`(1u << 4) - 1` → 15 (`1111`)'],
                ['`(x >> i) & ((1u << n) - 1)`', '{{n bitova počevši od bita i|n bits starting at bit i}}', '`(0xD6 >> 2) & 0xF` → 5'],
                ['`x & (x - 1)`', '{{briše najnižu jedinicu|clears the lowest set bit}}', '`12 & 11` → 8 (`1100` → `1000`)'],
                ['`x & -x`', '{{ostavlja samo najnižu jedinicu (x unsigned)|keeps only the lowest set bit (x unsigned)}}', '`12u & -12u` → 4'],
                ['`~x & (x + 1)`', '{{najniža nula, kao jedinica|the lowest 0 bit, as a 1}}', '`5` (`101`) → 2 (`010`)'],
                ['`x != 0 && (x & (x - 1)) == 0`', '{{x je potencija broja 2|x is a power of 2}}', '8 → 1, 6 → 0'],
                ['`x << k`, `x >> k`', '{{množenje / dijeljenje s 2^k (unsigned)|multiply / divide by 2^k (unsigned)}}', '`3u << 2` → 12, `13u >> 2` → 3']
            ]
        },
        {
            id: 'formats', hr: 'printf / scanf formati', en: 'printf / scanf formats',
            tags: 'printf scanf format specifikator specifier %d %f %lf %s %c sirina width preciznost precision',
            noteHr: '`printf("%f")` radi i za float i za double (float se proširi u double), ali `scanf` traži `%f` za `float *` i `%lf` za `double *`. `scanf` vraća broj uspješno pridruženih vrijednosti, a `EOF` na kraju ulaza.',
            noteEn: '`printf("%f")` works for both float and double (float is promoted), but `scanf` needs `%f` for `float *` and `%lf` for `double *`. `scanf` returns the number of values assigned, or `EOF` at end of input.',
            cols: ['Format', '{{Značenje|Meaning}}'],
            rows: [
                ['`%d` `%i`', 'int ({{kod scanf `%i` prihvaća i 0x.. i 0..|in scanf, `%i` also accepts 0x.. and 0..}})'],
                ['`%u` `%ld` `%lld` `%hd`', 'unsigned, long, long long, short'],
                ['`%c`', '{{jedan znak|a single character}}'],
                ['`%s`', '{{niz znakova (scanf čita do bjeline)|string (scanf reads up to whitespace)}}'],
                ['`%f` `%e` `%g`', '{{realni: decimalno, eksponencijalno, kraće od ta dva|floating: fixed, scientific, the shorter of the two}}'],
                ['`%lf` / `%Lf`', 'double (scanf) / long double'],
                ['`%x` `%X` `%o`', '{{heksadekadski, oktalni|hexadecimal, octal}}'],
                ['`%p`', '{{pokazivač|pointer}}'],
                ['`%zu`', 'size_t ({{rezultat sizeof|result of sizeof}})'],
                ['`%%`', '{{znak %|percent sign}}'],
                ['`%5d` / `%-5d`', '{{širina 5, desno / lijevo poravnato|width 5, right / left aligned}}'],
                ['`%05d` / `%+d`', '{{nadopuna nulama / uvijek ispiši predznak|zero padding / always show the sign}}'],
                ['`%.2f` / `%8.3f`', '{{2 decimale (zaokruženo) / širina 8, 3 decimale|2 decimals (rounded) / width 8, 3 decimals}}'],
                ['`%.3s` / `%*d`', '{{najviše 3 znaka / širina iz argumenta|at most 3 characters / width from an argument}}'],
                ['scanf `" %c"`', '{{razmak preskače bjeline (i `\\n`) prije znaka|the space skips whitespace (and `\\n`) before the character}}'],
                ['scanf `%30s`', '{{najviše 30 znakova, polje mora imati 31 mjesto|at most 30 characters, the array needs 31}}'],
                ['scanf `%[^\\n]` / `%[^;]`', '{{čitaj do kraja retka / do znaka ;|read up to the end of the line / up to ;}}'],
                ['scanf `%*d`', '{{pročitaj i odbaci|read and discard}}']
            ]
        },
        {
            id: 'precedence', hr: 'Prioritet operatora', en: 'Operator precedence',
            tags: 'prioritet precedence asocijativnost associativity operator redoslijed order',
            noteHr: 'Od najvišeg prema najnižem. U nedoumici stavi zagrade. Pazi: `a & b == c` je `a & (b == c)`, a `*p++` je `*(p++)`.',
            noteEn: 'Highest to lowest. When in doubt, use parentheses. Watch out: `a & b == c` means `a & (b == c)`, and `*p++` means `*(p++)`.',
            cols: ['#', '{{Operatori|Operators}}', '{{Asocijativnost|Associativity}}'],
            rows: [
                ['1', '`()` `[]` `->` `.` `x++` `x--`', '{{L → D|L → R}}'],
                ['2', '`++x` `--x` `+x` `-x` `!` `~` `({{tip|type}})` `*p` `&x` `sizeof`', '{{D → L|R → L}}'],
                ['3', '`*` `/` `%`', '{{L → D|L → R}}'],
                ['4', '`+` `-`', '{{L → D|L → R}}'],
                ['5', '`<<` `>>`', '{{L → D|L → R}}'],
                ['6', '`<` `<=` `>` `>=`', '{{L → D|L → R}}'],
                ['7', '`==` `!=`', '{{L → D|L → R}}'],
                ['8', '`&`', '{{L → D|L → R}}'],
                ['9', '`^`', '{{L → D|L → R}}'],
                ['10', '`|`', '{{L → D|L → R}}'],
                ['11', '`&&`', '{{L → D|L → R}}'],
                ['12', '`||`', '{{L → D|L → R}}'],
                ['13', '`?:`', '{{D → L|R → L}}'],
                ['14', '`=` `+=` `-=` `*=` `/=` `%=` `<<=` `>>=` `&=` `^=` `|=`', '{{D → L|R → L}}'],
                ['15', '`,`', '{{L → D|L → R}}']
            ]
        },
        {
            id: 'conversions', hr: 'Aritmetika i pretvorbe tipova', en: 'Arithmetic and type conversions',
            tags: 'cjelobrojno dijeljenje integer division modulo ostatak remainder pretvorba konverzija conversion cast promocija promotion unsigned implicitna implicit',
            cols: ['{{Pravilo|Rule}}', '{{Primjer|Example}}'],
            rows: [
                ['{{Cjelobrojno dijeljenje odsijeca prema nuli|Integer division truncates toward zero}}', '`7 / 2 == 3`, `-7 / 2 == -3`'],
                ['{{Predznak ostatka % prati djeljenik|The sign of % follows the dividend}}', '`-7 % 2 == -1`, `7 % -2 == 1`'],
                ['{{Barem jedan realni operand daje realno dijeljenje|One floating-point operand means floating division}}', '`1 / 2 == 0`, `1.0 / 2 == 0.5`'],
                ['{{Pretvorba (cast) prije dijeljenja|Cast before dividing}}', '`(double) a / b` ({{ne|not}} `(double) (a / b)`)'],
                ['{{char, short i _Bool postaju int u izrazima|char, short and _Bool are promoted to int}}', '`\'a\' + 1 == 98`'],
                ['{{Uobičajene aritmetičke pretvorbe|Usual arithmetic conversions}}', 'long double > double > float > long long > long > int'],
                ['{{signed i unsigned istog ranga daju unsigned|signed with unsigned of the same rank becomes unsigned}}', '`-1 < 1u` {{je 0 (laž)!|is 0 (false)!}}'],
                ['{{Realni u cijeli broj odsijeca prema nuli|Floating to integer truncates toward zero}}', '`(int) 3.99 == 3`, `(int) -3.99 == -3`'],
                ['{{Znamenka (znak) u broj|Digit character to value}}', '`c - \'0\'` (`\'7\' - \'0\' == 7`)'],
                ['{{0 je laž, sve ostalo je istina|0 is false, everything else is true}}', '`!5 == 0`, `(3 < 5) == 1`'],
                ['{{Kratkospojno vrednovanje|Short-circuit evaluation}}', '`p != NULL && *p > 0` ({{desna strana se ne računa ako je p NULL|the right side is skipped if p is NULL}})'],
                ['{{Ne mijenjaj istu varijablu dvaput u jednom izrazu|Don\'t modify a variable twice in one expression}}', '`i = i++` → {{nedefinirano ponašanje|undefined behaviour}}']
            ]
        },
        {
            id: 'pointers', hr: 'Pokazivači i const', en: 'Pointers and const',
            tags: 'pokazivac pointer adresa address dereferenciranje dereference const null aritmetika arithmetic dvostruki double pointer strelica arrow -> %p',
            noteHr: 'Pokazivač prije korištenja mora pokazivati na nešto valjano. Nakon `free(p)` postavi `p = NULL`. Vraćanje adrese lokalne varijable iz funkcije je greška.',
            noteEn: 'A pointer must point to something valid before it is used. After `free(p)`, set `p = NULL`. Returning the address of a local variable from a function is a bug.',
            cols: ['{{Zapis|Code}}', '{{Značenje|Meaning}}'],
            rows: [
                ['`int *p = &x;`', '{{p sadrži adresu od x|p holds the address of x}}'],
                ['`*p = 20;`', '{{mijenja x preko pokazivača (dereferenciranje)|changes x through the pointer (dereferencing)}}'],
                ['`int *a, b;`', '{{samo je a pokazivač, b je obični int|only a is a pointer; b is a plain int}}'],
                ['`int *p = NULL;` … `if (p != NULL)`', '{{pokazivač koji ne pokazuje nikamo; provjeri prije korištenja|a pointer to nothing; check before use}}'],
                ['`arr[i]` ≡ `*(arr + i)`, `&arr[i]` ≡ `arr + i`', '{{ime polja je adresa prvog elementa|the array name is the address of the first element}}'],
                ['`p + n`, `p++`', '{{pomak za n (ili 1) elemenata, a ne bajtova|moves by n (or 1) elements, not bytes}}'],
                ['`q - p`', '{{broj elemenata između dva pokazivača u istom polju, npr. indeks:|number of elements between two pointers into the same array, e.g. an index:}} `strchr(s, c) - s`'],
                ['`const int *p`', '{{vrijednost je samo za čitanje (`*p = 1` je greška), p se smije preusmjeriti|the value is read-only (`*p = 1` is an error); p may point elsewhere}}'],
                ['`int *const p`', '{{pokazivač je fiksan (`p = &y` je greška), vrijednost se smije mijenjati|the pointer is fixed (`p = &y` is an error); the value may change}}'],
                ['`const int *const p`', '{{ne mogu se mijenjati ni pokazivač ni vrijednost|neither the pointer nor the value can change}}'],
                ['`void f(int *out)` … `f(&x);`', '{{funkcija mijenja varijablu pozivatelja (tako se vraća više vrijednosti)|the function changes the caller\'s variable (a way to return several values)}}'],
                ['`void f(int arr[])` ≡ `void f(int *arr)`', '{{polje se predaje kao pokazivač, pa predaj i duljinu|an array is passed as a pointer, so pass its length too}}'],
                ['`p->x` ≡ `(*p).x`', '{{član strukture preko pokazivača|struct member through a pointer}}'],
                ['`int **pp = &p;`', '{{pokazivač na pokazivač (`**pp` je x); za dinamičke matrice i kad funkcija mijenja pokazivač|pointer to a pointer (`**pp` is x); for dynamic matrices and when a function changes a pointer}}'],
                ['`printf("%p", (void *) p)`', '{{ispis adrese|print an address}}']
            ]
        },
        {
            id: 'ascii', hr: 'ASCII i posebni znakovi', en: 'ASCII and escape sequences',
            tags: 'ascii escape sekvence sequences znakovi characters kodovi codes \\n \\t \\0 tablica table',
            cols: ['{{Znak|Char}}', '{{Kod|Code}}', '{{Znak|Char}}', '{{Kod|Code}}'],
            rows: [
                ['`\'\\0\'` ({{nul-znak|null character}})', '0', '`\'0\'` … `\'9\'`', '48 … 57'],
                ['`\'\\t\'` (tab)', '9', '`\'A\'` … `\'Z\'`', '65 … 90'],
                ['`\'\\n\'` ({{novi red|newline}})', '10', '`\'a\'` … `\'z\'`', '97 … 122'],
                ['`\'\\r\'` ({{povratak na početak retka|carriage return}})', '13', '`\'a\' - \'A\'`', '32'],
                ['`\' \'` ({{razmak|space}})', '32', '`\'\\\\\'` (backslash)', '92'],
                ['`\'\\\'\'` `\'\\"\'`', '39, 34', '`\'\\x41\'` / `\'\\101\'`', '65 (hex / {{okt.|oct.}})']
            ]
        },
        {
            id: 'stdlib', hr: 'Standardna biblioteka', en: 'Standard library',
            tags: 'string.h ctype.h stdlib.h math.h stdio.h strlen strcpy strcmp strcat strstr toupper isdigit malloc qsort sqrt pow fabs fopen fseek funkcije functions',
            noteHr: 'Za `math.h` Edgar povezuje s `-lm`. `M_PI` uz `-std=c11` NIJE definiran; koristi `#define PI 3.14159265358979323846`. `abs` je za int, `fabs` za double.',
            noteEn: 'Edgar links `math.h` with `-lm`. `M_PI` is NOT defined with `-std=c11`; use `#define PI 3.14159265358979323846`. `abs` is for int, `fabs` for double.',
            cols: ['{{Zaglavlje|Header}}', '{{Funkcije|Functions}}'],
            rows: [
                ['`string.h`', '`strlen` `strcpy` `strncpy` ({{ne mora dodati|may not add}} `\'\\0\'`) `strcat` `strcmp` (<0, 0, >0) `strncmp` `strchr` `strrchr` `strstr` `strcspn` `memset` `memcpy`'],
                ['`ctype.h`', '`isalpha` `isdigit` `isalnum` `isspace` `isupper` `islower` `ispunct` `toupper` `tolower`'],
                ['`stdlib.h`', '`malloc` `calloc` ({{nulira memoriju|zero-fills}}) `realloc` `free` `abs` `labs` `atoi` `atof` `strtol` `strtod` `qsort` `bsearch` `rand` `srand` `RAND_MAX` `exit` `EXIT_SUCCESS` `EXIT_FAILURE`'],
                ['`math.h`', '`sqrt` `pow` `fabs` `ceil` `floor` `round` `lround` `trunc` `fmod` `log` (ln) `log10` `log2` `exp` `sin` `cos` `tan` `atan2` `hypot`'],
                ['`stdio.h`', '`printf` `scanf` `getchar` `putchar` `puts` `fgets` `sprintf` `snprintf` `sscanf` `fopen` `fclose` `fprintf` `fscanf` `fgetc` `fputc` `fputs` `fread` `fwrite` `fseek` `ftell` `rewind` `feof` `remove` `rename`'],
                ['{{`fopen` načini|`fopen` modes}}', '`"r"` {{čitanje, datoteka mora postojati|read, the file must exist}}; `"w"` {{pisanje, briše sadržaj|write, truncates}}; `"a"` {{dodavanje na kraj|append}}; `"r+"` {{čitanje i pisanje|read and write}}; `"w+"`; `"a+"`; {{za binarne datoteke dodaj|for binary files add}} `b`: `"rb"` `"wb"` `"r+b"`'],
                ['{{`fseek` ishodište|`fseek` origin}}', '`SEEK_SET` ({{početak|start}}), `SEEK_CUR` ({{trenutna pozicija|current position}}), `SEEK_END` ({{kraj|end}})'],
                ['`limits.h` / `float.h`', '`INT_MAX` `INT_MIN` `UINT_MAX` `LLONG_MAX` `CHAR_BIT` / `FLT_MAX` `DBL_MAX` `FLT_EPSILON` `DBL_EPSILON` `FLT_DIG` `DBL_DIG`']
            ]
        },
        {
            id: 'matrix-parts', hr: 'Dijelovi kvadratne matrice', en: 'Parts of a square matrix',
            tags: 'matrica matrix dijagonala diagonal sporedna anti glavna main iznad above ispod below rub border',
            cols: ['{{Dio|Part}}', '{{Uvjet (n × n)|Condition (n × n)}}'],
            rows: [
                ['{{Glavna dijagonala|Main diagonal}}', '`i == j`'],
                ['{{Iznad / ispod glavne dijagonale|Above / below the main diagonal}}', '`i < j` / `i > j`'],
                ['{{Sporedna dijagonala|Anti-diagonal}}', '`i + j == n - 1`'],
                ['{{Iznad / ispod sporedne dijagonale|Above / below the anti-diagonal}}', '`i + j < n - 1` / `i + j > n - 1`'],
                ['{{Rub|Border}}', '`i == 0 || j == 0 || i == n - 1 || j == n - 1`'],
                ['{{Parametar funkcije|Function parameter}}', '`void f(int m[][MAXCOL], int r, int c)` {{ili VLA|or VLA}} `void f(int r, int c, int m[r][c])`'],
                ['{{Raspored u memoriji (po recima)|Memory layout (row-major)}}', '`m[i][j]` {{je|is}} `*(&m[0][0] + i * {{brojStupaca|numCols}} + j)`']
            ]
        },
        {
            id: 'complexity', hr: 'Složenost algoritama', en: 'Algorithm complexity',
            tags: 'slozenost complexity big o sortiranje sorting pretrazivanje searching merge quicksort counting stabilno stable',
            noteHr: 'Bubble sort, sortiranje umetanjem i merge sort su stabilni (jednaki elementi zadržavaju poredak); sortiranje izborom, quicksort i `qsort` nisu. Merge sort treba O(n) dodatne memorije. Sortiranje prebrojavanjem je za cijele brojeve iz malog raspona (npr. ocjene 1-5).',
            noteEn: 'Bubble sort, insertion sort and merge sort are stable (equal elements keep their order); selection sort, quicksort and `qsort` are not. Merge sort needs O(n) extra memory. Counting sort is for integers from a small range (e.g. grades 1-5).',
            cols: ['{{Algoritam|Algorithm}}', '{{Najbolji|Best}}', '{{Prosječni|Average}}', '{{Najgori|Worst}}'],
            rows: [
                ['{{Slijedno pretraživanje|Linear search}}', 'O(1)', 'O(n)', 'O(n)'],
                ['{{Binarno pretraživanje|Binary search}}', 'O(1)', 'O(log n)', 'O(log n)'],
                ['Bubble sort ({{s ranim prekidom|with early exit}})', 'O(n)', 'O(n²)', 'O(n²)'],
                ['{{Sortiranje izborom|Selection sort}}', 'O(n²)', 'O(n²)', 'O(n²)'],
                ['{{Sortiranje umetanjem|Insertion sort}}', 'O(n)', 'O(n²)', 'O(n²)'],
                ['Merge sort', 'O(n log n)', 'O(n log n)', 'O(n log n)'],
                ['Quicksort, qsort', 'O(n log n)', 'O(n log n)', 'O(n²)'],
                ['{{Sortiranje prebrojavanjem (k = veličina raspona)|Counting sort (k = size of the range)}}', 'O(n + k)', 'O(n + k)', 'O(n + k)'],
                ['{{Rekurzivni Fibonacci|Recursive Fibonacci}}', '-', 'O(2^n)', 'O(2^n)']
            ]
        },
        {
            id: 'pitfalls', hr: 'Česte greške', en: 'Common mistakes',
            tags: 'greske pitfalls bug cesto common mistakes',
            cols: ['{{Greška|Mistake}}', '{{Ispravno|Fix}}'],
            rows: [
                ['`if (x = 5)`', '`if (x == 5)`'],
                ['`scanf("%d", n)`', '`scanf("%d", &n)` ({{za niz znakova bez &|no & for strings}})'],
                ['`scanf("%f", &d)` {{za double|for a double}}', '`scanf("%lf", &d)`'],
                ['`double p = 1 / 3;` {{daje 0|gives 0}}', '`1.0 / 3` {{ili|or}} `(double) a / b`'],
                ['`if (a == 0.3)` {{s realnim brojevima|with floating-point numbers}}', '`fabs(a - 0.3) < 1e-9`'],
                ['`char s[5] = "hello";` ({{nema mjesta za|no room for}} `\'\\0\'`)', '`char s[6]` {{ili|or}} `char s[] = "hello";`'],
                ['`s1 == s2` {{za usporedbu nizova|to compare strings}}', '`strcmp(s1, s2) == 0`'],
                ['`s1 = s2` {{za kopiranje niza|to copy a string}}', '`strcpy(s1, s2)`'],
                ['`for (...);` {{ili|or}} `if (...);` {{sa suvišnim ;|with a stray ;}}', '{{makni|remove the}} `;`'],
                ['`sizeof(arr)` {{unutar funkcije daje veličinu pokazivača|inside a function gives the pointer size}}', '{{predaj broj elemenata kao parametar|pass the length as a parameter}}'],
                ['{{Vraćanje adrese lokalne varijable|Returning the address of a local variable}}', '`static`, `malloc` {{ili polje od pozivatelja|or an array from the caller}}'],
                ['`while (!feof(f)) { fscanf(...); }`', '`while (fscanf(...) == n) { ... }`'],
                ['`for (unsigned i = n - 1; i >= 0; i--)` {{je beskonačna petlja|is an infinite loop}}', '{{koristi|use}} `int i`'],
                ['`switch` {{bez `break` propada u sljedeći case|without `break` falls through to the next case}}', '{{dodaj|add}} `break;`'],
                ['{{Neinicijalizirana varijabla (npr. zbroj)|Uninitialized variable (e.g. a sum)}}', '`int sum = 0;`'],
                ['`fgets` {{nakon|after}} `scanf("%d")` {{čita prazan redak|reads an empty line}}', '{{pročitaj|consume the}} `\\n` ({{npr.|e.g.}} `getchar()`) {{ili|or}} `scanf(" %[^\\n]", s)`'],
                ['`\'a\'` {{i|and}} `"a"` {{nisu isto|are not the same}}', '`\'a\'` {{je znak (int), a|is a character (int), while}} `"a"` {{je niz|is the string}} `{\'a\', \'\\0\'}`'],
                ['{{Pristup|Accessing}} `arr[n]` {{u polju od n elemenata|in an n-element array}}', '{{indeksi su|indices are}} `0 … n - 1`']
            ]
        }
    ];

    // English versions of the comments and strings inside snippet code.
    const CODE_EN = [
        ['printf("Upisite n (1-100) > ");', 'printf("Enter n (1-100) > ");'],
        ['/* obradi x */', '/* process x */'],
        ['printf("Nepoznata opcija\\n");', 'printf("Unknown option\\n");'],
        ['/* piramida visine n */', '/* pyramid of height n */'],
        ['/* ispis svih 32 bita, grupirano po 8 */', '/* print all 32 bits, grouped by 8 */'],
        ['/* x u bazi 2..16; out mora imati barem 33 mjesta */', '/* x in base 2..16; out needs room for at least 33 chars */'],
        ['/* a i b smatramo jednakima */', '/* treat a and b as equal */'],
        ['/* na 2 decimale */', '/* to 2 decimal places */'],
        ['/* najbliži cijeli broj */', '/* nearest integer */'],
        ['/* odsijecanje prema nuli */', '/* truncation toward zero */'],
        ['/* izbacuje element s indeksom idx */', '/* removes the element at index idx */'],
        ['/* ubacuje value na indeks idx; polje mora imati mjesta za n + 1 element */', '/* inserts value at index idx; the array needs room for n + 1 elements */'],
        ['/* vrijednosti 0..100 */', '/* values 0..100 */'],
        ['/* silazno: (x < y) - (x > y) */', '/* descending: (x < y) - (x > y) */'],
        ['/* za char rijeci[N][MAX] */', '/* for char words[N][MAX] */'],
        ['/* za char *rijeci[N] (polje pokazivača) */', '/* for char *words[N] (array of pointers) */'],
        ["/* makni '\\n' s kraja */", "/* strip the trailing '\\n' */"],
        ['/* broj -> niz */', '/* number -> string */'],
        ['/* čitanje iz niza */', '/* read from a string */'],
        ['/* transponiranje kvadratne matrice na mjestu */', '/* transpose a square matrix in place */'],
        ['printf("Nema dovoljno memorije\\n");', 'printf("Out of memory\\n");'],
        ['/* ... koristi arr[0] .. arr[n - 1] ... */', '/* ... use arr[0] .. arr[n - 1] ... */'],
        ['printf("Ne mogu otvoriti datoteku\\n");', 'printf("Cannot open the file\\n");'],
        ['"ulaz.txt"', '"input.txt"'],
        ['"izlaz.txt"', '"output.txt"'],
        ['"podaci.bin"', '"data.bin"'],
        ['/* obradi jedan zapis */', '/* process one record */'],
        ['/* n zapisa iz polja */', '/* n records from the array */'],
        ['/* obradi zapis it */', '/* process record it */'],
        ['/* broj zapisa u datoteci */', '/* number of records in the file */'],
        ['/* čitanje zapisa s indeksom k (od 0) */', '/* read the record at index k (from 0) */'],
        ['/* izmjena tog istog zapisa */', '/* update that same record */'],
        ['/* x^n za n >= 0 */', '/* x^n for n >= 0 */']
    ];
    // Snippets with an explicit `codeEn` keep it; the rest get CODE_EN applied to `code`.
    snippets.forEach(s => {
        let c = s.code;
        CODE_EN.forEach(([hr, en]) => { c = c.split(hr).join(en); });
        s.codeEn = s.codeEn || c;
    });

    // ------------------------------------------------------------------ Glossary (HR / EN)
    const glossary = [
        { hr: 'Varijabla', en: 'Variable', dHr: 'Imenovana memorijska lokacija u kojoj se pohranjuje vrijednost određenog tipa.', dEn: 'A named memory location that stores a value of a specific type.' },
        { hr: 'Tip podatka', en: 'Data type', dHr: 'Određuje skup vrijednosti koje podatak može poprimiti, dopuštene operacije i veličinu u memoriji.', dEn: 'Defines the set of possible values, the allowed operations and the size in memory.' },
        { hr: 'Deklaracija', en: 'Declaration', dHr: 'Uvodi ime i njegov tip (varijable ili funkcije) prevodiocu.', dEn: 'Introduces a name and its type (of a variable or function) to the compiler.' },
        { hr: 'Definicija', en: 'Definition', dHr: 'Deklaracija koja još i rezervira memoriju (varijabla) ili sadrži tijelo (funkcija). Smije postojati samo jednom.', dEn: 'A declaration that also allocates storage (variable) or provides the body (function). May appear only once.' },
        { hr: 'Inicijalizacija', en: 'Initialization', dHr: 'Pridjeljivanje početne vrijednosti pri definiciji, npr. `int n = 0;`. Lokalne varijable bez inicijalizacije imaju neodređenu vrijednost.', dEn: 'Giving an initial value at the definition, e.g. `int n = 0;`. Uninitialized local variables hold indeterminate values.' },
        { hr: 'Izraz', en: 'Expression', dHr: 'Kombinacija operanada i operatora koja se izračunava u vrijednost, npr. `a + 2 * b`.', dEn: 'A combination of operands and operators that evaluates to a value, e.g. `a + 2 * b`.' },
        { hr: 'Naredba', en: 'Statement', dHr: 'Osnovna jedinica izvršavanja: izraz s `;`, blok `{ }`, `if`, petlja, `return`...', dEn: 'The basic unit of execution: an expression with `;`, a block `{ }`, `if`, a loop, `return`...' },
        { hr: 'Blok', en: 'Block (compound statement)', dHr: 'Niz naredbi unutar `{ }`. Varijable definirane u bloku vidljive su samo u njemu.', dEn: 'A sequence of statements inside `{ }`. Variables defined in a block are visible only within it.' },
        { hr: 'Operator pretvorbe tipa (cast)', en: 'Cast operator', dHr: 'Eksplicitna pretvorba vrijednosti u drugi tip: `(double) a`.', dEn: 'Explicit conversion of a value to another type: `(double) a`.' },
        { hr: 'Implicitna pretvorba', en: 'Implicit conversion', dHr: 'Automatska pretvorba koju obavlja prevodilac, npr. int u double u izrazu s mješovitim tipovima ili pri pridruživanju.', dEn: 'Automatic conversion performed by the compiler, e.g. int to double in a mixed expression or on assignment.' },
        { hr: 'Cjelobrojno dijeljenje', en: 'Integer division', dHr: 'Dijeljenje dva cijela broja; rezultat se odsijeca prema nuli (`7 / 2 == 3`), a `%` daje ostatak.', dEn: 'Division of two integers; the result is truncated toward zero (`7 / 2 == 3`), and `%` gives the remainder.' },
        { hr: 'Preljev', en: 'Overflow', dHr: 'Rezultat ne stane u raspon tipa. Kod unsigned tipova računa se modulo 2^n, a kod signed tipova ponašanje je nedefinirano.', dEn: 'The result doesn\'t fit the type\'s range. Unsigned types wrap modulo 2^n; for signed types the behaviour is undefined.' },
        { hr: 'Dvojni komplement', en: 'Two\'s complement', dHr: 'Prikaz negativnih cijelih brojeva: -x se dobije invertiranjem bitova od x i dodavanjem 1. Raspon n bitova je -2^(n-1) … 2^(n-1) - 1.', dEn: 'Representation of negative integers: -x is obtained by inverting the bits of x and adding 1. The n-bit range is -2^(n-1) … 2^(n-1) - 1.' },
        { hr: 'Mantisa', en: 'Mantissa (significand)', dHr: 'Dio realnog broja (IEEE 754) koji nosi značajne znamenke. Kod normaliziranih brojeva vodeća jedinica se ne pohranjuje (skriveni bit).', dEn: 'The part of a floating-point number (IEEE 754) holding the significant digits. For normal numbers the leading 1 is not stored (hidden bit).' },
        { hr: 'Karakteristika', en: 'Biased exponent', dHr: 'Pohranjeni eksponent uvećan za pomak: 127 kod float, 1023 kod double. Karakteristika = eksponent + pomak.', dEn: 'The stored exponent increased by a bias: 127 for float, 1023 for double. Stored exponent = exponent + bias.' },
        { hr: 'Denormalizirani broj', en: 'Subnormal (denormalized) number', dHr: 'Broj s karakteristikom 0 i mantisom različitom od 0. Vrijednost je 0.m · 2^(1 - pomak); omogućuje prikaz brojeva bližih nuli.', dEn: 'A number with a stored exponent of 0 and a non-zero mantissa. Its value is 0.m · 2^(1 - bias); it allows numbers closer to zero.' },
        { hr: 'NaN', en: 'NaN (Not a Number)', dHr: 'Posebna vrijednost (karakteristika sve jedinice, mantisa ≠ 0), npr. rezultat `0.0 / 0.0` ili `sqrt(-1)`. NaN nije jednak ni samom sebi.', dEn: 'A special value (exponent all ones, mantissa ≠ 0), e.g. the result of `0.0 / 0.0` or `sqrt(-1)`. NaN is not even equal to itself.' },
        { hr: 'Beskonačnost', en: 'Infinity', dHr: 'Karakteristika sve jedinice, mantisa 0; npr. `1.0 / 0.0` daje +∞.', dEn: 'Exponent all ones, mantissa 0; e.g. `1.0 / 0.0` gives +∞.' },
        { hr: 'Jednostruka / dvostruka preciznost', en: 'Single / double precision', dHr: 'IEEE 754 formati od 32 bita (float, ~7 znamenki) i 64 bita (double, ~16 znamenki).', dEn: 'IEEE 754 formats of 32 bits (float, ~7 digits) and 64 bits (double, ~16 digits).' },
        { hr: 'Polje', en: 'Array', dHr: 'Niz elemenata istog tipa smještenih uzastopno u memoriji, indeksiranih od 0 do n - 1. Ime polja u izrazu predstavlja adresu prvog elementa.', dEn: 'A sequence of elements of the same type stored contiguously, indexed from 0 to n - 1. In an expression, the array name stands for the address of its first element.' },
        { hr: 'Višedimenzijsko polje', en: 'Multidimensional array', dHr: 'Polje polja. U memoriji se pohranjuje po recima. Kao parametar funkcije moraju se navesti sve dimenzije osim prve.', dEn: 'An array of arrays, stored row by row (row-major). As a function parameter, all dimensions except the first must be given.' },
        { hr: 'Znakovni niz', en: 'String', dHr: 'Polje znakova zaključeno nul-znakom `\'\\0\'`. Niz od n znakova treba polje od n + 1 mjesta.', dEn: 'A char array terminated by the null character `\'\\0\'`. A string of n characters needs an array of n + 1.' },
        { hr: 'Nul-znak', en: 'Null character', dHr: 'Znak s kodom 0 (`\'\\0\'`) koji označava kraj znakovnog niza.', dEn: 'The character with code 0 (`\'\\0\'`) that marks the end of a string.' },
        { hr: 'Pokazivač', en: 'Pointer', dHr: 'Varijabla koja sadrži adresu drugog objekta. Tip pokazivača određuje kako se tumači memorija na koju pokazuje.', dEn: 'A variable that holds the address of another object. The pointer\'s type determines how the memory it points to is interpreted.' },
        { hr: 'Adresni operator (&)', en: 'Address-of operator (&)', dHr: '`&x` daje adresu objekta x u memoriji.', dEn: '`&x` yields the address of object x in memory.' },
        { hr: 'Dereferenciranje', en: 'Dereferencing', dHr: 'Pristup objektu na koji pokazivač pokazuje, operatorom `*`: `*p = 5;`.', dEn: 'Accessing the object a pointer points to, with the `*` operator: `*p = 5;`.' },
        { hr: 'NULL pokazivač', en: 'Null pointer', dHr: 'Pokazivač koji ne pokazuje ni na jedan objekt. Dereferenciranje NULL pokazivača je nedefinirano ponašanje.', dEn: 'A pointer that points to no object. Dereferencing a null pointer is undefined behaviour.' },
        { hr: 'Aritmetika pokazivača', en: 'Pointer arithmetic', dHr: '`p + n` pomiče pokazivač za n elemenata (n · sizeof(*p) bajtova). Razlika dva pokazivača unutar istog polja je broj elemenata između njih. `arr[i]` je isto što i `*(arr + i)`.', dEn: '`p + n` moves the pointer by n elements (n · sizeof(*p) bytes). The difference of two pointers into the same array is the number of elements between them. `arr[i]` is the same as `*(arr + i)`.' },
        { hr: 'Pokazivač na void', en: 'Void pointer', dHr: 'Generički pokazivač (`void *`) koji može sadržavati adresu bilo kojeg tipa. Prije dereferenciranja mora se pretvoriti u konkretni tip, npr. `*(int *) pv`.', dEn: 'A generic pointer (`void *`) that can hold the address of any type. It must be converted to a concrete type before dereferencing, e.g. `*(int *) pv`.' },
        { hr: 'l-vrijednost', en: 'lvalue', dHr: 'Izraz koji označava objekt u memoriji (ima adresu) i zato smije stajati s lijeve strane pridruživanja, npr. `x`, `arr[i]`, `*p`.', dEn: 'An expression that designates an object in memory (has an address), so it may appear on the left of an assignment, e.g. `x`, `arr[i]`, `*p`.' },
        { hr: 'Funkcija', en: 'Function', dHr: 'Imenovani blok koda koji prima parametre i može vratiti vrijednost. `void` funkcija ne vraća vrijednost.', dEn: 'A named block of code that takes parameters and may return a value. A `void` function returns nothing.' },
        { hr: 'Prototip funkcije', en: 'Function prototype', dHr: 'Deklaracija funkcije bez tijela (povratni tip, ime, tipovi parametara), npr. `int max(int a, int b);`. Omogućuje poziv prije definicije.', dEn: 'A function declaration without a body (return type, name, parameter types), e.g. `int max(int a, int b);`. Allows calling before the definition.' },
        { hr: 'Parametar i argument', en: 'Parameter and argument', dHr: 'Parametar je varijabla u definiciji funkcije, a argument vrijednost koja se predaje pri pozivu.', dEn: 'A parameter is the variable in the function definition; an argument is the value passed at the call.' },
        { hr: 'Prijenos po vrijednosti', en: 'Pass by value', dHr: 'C uvijek predaje kopiju argumenta. Da bi funkcija promijenila varijablu pozivatelja, predaje joj se adresa (pokazivač).', dEn: 'C always passes a copy of the argument. For a function to change the caller\'s variable, pass its address (a pointer).' },
        { hr: 'Rekurzija', en: 'Recursion', dHr: 'Funkcija koja poziva samu sebe. Mora imati osnovni (bazni) slučaj koji zaustavlja pozive, inače dolazi do preljeva stoga.', dEn: 'A function that calls itself. It must have a base case that stops the calls, otherwise the stack overflows.' },
        { hr: 'Stog', en: 'Stack', dHr: 'Dio memorije za lokalne varijable i povratne adrese poziva funkcija. Oslobađa se automatski pri izlasku iz funkcije.', dEn: 'Memory area for local variables and the return addresses of function calls. Freed automatically when a function returns.' },
        { hr: 'Gomila (heap)', en: 'Heap', dHr: 'Dio memorije za dinamičku alokaciju (`malloc`). Programer je mora sam osloboditi s `free`.', dEn: 'Memory area for dynamic allocation (`malloc`). The programmer must free it with `free`.' },
        { hr: 'Doseg', en: 'Scope', dHr: 'Dio programa u kojem je ime vidljivo: blok, funkcija ili cijela datoteka (globalne varijable).', dEn: 'The part of the program where a name is visible: a block, a function, or the whole file (global variables).' },
        { hr: 'Trajnost pohrane', en: 'Storage duration', dHr: 'Koliko dugo objekt postoji: automatski (do kraja bloka), statički (cijelo izvođenje: globalne i `static` varijable), dinamički (od `malloc` do `free`).', dEn: 'How long an object exists: automatic (until the end of the block), static (the whole run: globals and `static` variables), dynamic (from `malloc` to `free`).' },
        { hr: 'Statička lokalna varijabla', en: 'Static local variable', dHr: 'Lokalna varijabla označena sa `static` koja zadržava vrijednost između poziva funkcije i inicijalizira se samo jednom (na 0 ako nije navedeno).', dEn: 'A local variable marked `static` that keeps its value between function calls and is initialized only once (to 0 if not given).' },
        { hr: 'Globalna varijabla', en: 'Global variable', dHr: 'Varijabla definirana izvan svih funkcija, vidljiva u cijeloj datoteci; automatski inicijalizirana na 0.', dEn: 'A variable defined outside all functions, visible in the whole file; automatically initialized to 0.' },
        { hr: 'Struktura', en: 'Structure (struct)', dHr: 'Složeni tip koji grupira članove različitih tipova. Članu se pristupa s `.`, a preko pokazivača s `->` (`p->x` je `(*p).x`).', dEn: 'A compound type grouping members of different types. Access a member with `.`, or via a pointer with `->` (`p->x` is `(*p).x`).' },
        { hr: 'typedef', en: 'typedef', dHr: 'Uvodi novo ime (sinonim) za postojeći tip, npr. `typedef unsigned int uint;`.', dEn: 'Introduces a new name (alias) for an existing type, e.g. `typedef unsigned int uint;`.' },
        { hr: 'Pobrojani tip (enum)', en: 'Enumeration (enum)', dHr: 'Tip s imenovanim cjelobrojnim konstantama; prva je 0, svaka sljedeća za 1 veća, ako nije drukčije zadano.', dEn: 'A type with named integer constants; the first is 0 and each next is 1 greater unless specified otherwise.' },
        { hr: 'Dinamička alokacija memorije', en: 'Dynamic memory allocation', dHr: 'Zauzimanje memorije za vrijeme izvođenja (`malloc`, `calloc`, `realloc`) na gomili. Oslobađa se s `free`.', dEn: 'Allocating memory at run time (`malloc`, `calloc`, `realloc`) on the heap. Released with `free`.' },
        { hr: 'Curenje memorije', en: 'Memory leak', dHr: 'Dinamički zauzeta memorija koja se nikad ne oslobodi, obično zato što je izgubljen pokazivač na nju.', dEn: 'Dynamically allocated memory that is never freed, usually because the pointer to it was lost.' },
        { hr: 'Viseći pokazivač', en: 'Dangling pointer', dHr: 'Pokazivač na memoriju koja više nije valjana: nakon `free` ili na lokalnu varijablu funkcije koja je završila.', dEn: 'A pointer to memory that is no longer valid: after `free`, or to a local variable of a function that has returned.' },
        { hr: 'Datoteka (tekstualna / binarna)', en: 'File (text / binary)', dHr: 'Tekstualna datoteka sadrži znakove organizirane u retke (`fprintf`, `fscanf`). Binarna sprema podatke točno kako su u memoriji (`fwrite`, `fread`).', dEn: 'A text file contains characters organized into lines (`fprintf`, `fscanf`). A binary file stores data exactly as it is in memory (`fwrite`, `fread`).' },
        { hr: 'Tok podataka', en: 'Stream', dHr: 'Apstrakcija izvora ili odredišta podataka (`FILE *`). Standardni tokovi: `stdin`, `stdout`, `stderr`.', dEn: 'An abstraction of a data source or destination (`FILE *`). Standard streams: `stdin`, `stdout`, `stderr`.' },
        { hr: 'Izravan pristup datoteci', en: 'Random access', dHr: 'Postavljanje pozicije u datoteci s `fseek` i čitanje ili pisanje na tom mjestu bez čitanja svega prije.', dEn: 'Setting the file position with `fseek` and reading or writing there without reading everything before it.' },
        { hr: 'Pretprocesor', en: 'Preprocessor', dHr: 'Obrađuje izvorni kod prije prevođenja: `#include` (umetanje datoteke), `#define` (makroi), uvjetno prevođenje (`#if`, `#ifdef`).', dEn: 'Processes source code before compilation: `#include` (inserting a file), `#define` (macros), conditional compilation (`#if`, `#ifdef`).' },
        { hr: 'Makro', en: 'Macro', dHr: 'Ime definirano s `#define` koje pretprocesor tekstualno zamjenjuje. Argumente i cijeli izraz treba staviti u zagrade: `#define SQ(x) ((x) * (x))`.', dEn: 'A name defined with `#define` that the preprocessor replaces textually. Parenthesize arguments and the whole body: `#define SQ(x) ((x) * (x))`.' },
        { hr: 'Prevodilac i povezivač', en: 'Compiler and linker', dHr: 'Prevodilac pretvara izvorni kod u objektni kod; povezivač spaja objektne datoteke i biblioteke u izvršni program (npr. `-lm` za math).', dEn: 'The compiler turns source code into object code; the linker combines object files and libraries into an executable (e.g. `-lm` for math).' },
        { hr: 'Zaglavlje', en: 'Header file', dHr: 'Datoteka `.h` s deklaracijama (prototipi, tipovi, makroi) koja se uključuje s `#include`.', dEn: 'A `.h` file with declarations (prototypes, types, macros) that is included with `#include`.' },
        { hr: 'Nedefinirano ponašanje', en: 'Undefined behaviour (UB)', dHr: 'Situacija za koju standard ne propisuje rezultat (pristup izvan polja, preljev signed tipa, neinicijalizirana varijabla, dijeljenje nulom). Program može učiniti bilo što.', dEn: 'A situation for which the standard prescribes no result (out-of-bounds access, signed overflow, uninitialized variable, division by zero). The program may do anything.' },
        { hr: 'Kratkospojno vrednovanje', en: 'Short-circuit evaluation', dHr: 'Kod `&&` i `||` desni operand se ne izračunava ako je rezultat poznat već iz lijevog.', dEn: 'With `&&` and `||`, the right operand is not evaluated if the result is already known from the left one.' },
        { hr: 'Bitovni operatori', en: 'Bitwise operators', dHr: '`&` (I / AND), `|` (ILI / OR), `^` (isključivo ILI / XOR), `~` (komplement), `<<` i `>>` (pomaci). Rade nad pojedinim bitovima cijelih brojeva.', dEn: '`&` (AND), `|` (OR), `^` (XOR), `~` (complement), `<<` and `>>` (shifts). They operate on the individual bits of integers.' },
        { hr: 'Maska bitova', en: 'Bit mask', dHr: 'Broj čije jedinice označavaju bitove s kojima radimo: `x | maska` ih postavlja, `x & ~maska` briše, `x ^ maska` invertira, a `x & maska` izdvaja.', dEn: 'A number whose 1 bits mark the bits to work on: `x | mask` sets them, `x & ~mask` clears them, `x ^ mask` toggles them, and `x & mask` extracts them.' },
        { hr: 'Prioritet i asocijativnost', en: 'Precedence and associativity', dHr: 'Prioritet određuje koji se operator primjenjuje prvi; asocijativnost određuje redoslijed kod operatora istog prioriteta (npr. `=` je zdesna nalijevo).', dEn: 'Precedence decides which operator applies first; associativity decides the order among operators of equal precedence (e.g. `=` is right-to-left).' },
        { hr: 'Petlje (while, do-while, for)', en: 'Loops (while, do-while, for)', dHr: '`while` provjerava uvjet prije svakog prolaza, `do-while` nakon (tijelo se izvede barem jednom), a `for` objedinjuje inicijalizaciju, uvjet i korak.', dEn: '`while` checks the condition before each pass, `do-while` after (the body runs at least once), and `for` combines initialization, condition and step.' },
        { hr: 'break i continue', en: 'break and continue', dHr: '`break` izlazi iz najbliže petlje ili `switch`-a; `continue` preskače ostatak tijela petlje i prelazi na sljedeći prolaz.', dEn: '`break` exits the innermost loop or `switch`; `continue` skips the rest of the loop body and goes to the next iteration.' },
        { hr: 'sizeof', en: 'sizeof', dHr: 'Operator koji daje veličinu tipa ili objekta u bajtovima (tip `size_t`). Za polje u istoj funkciji daje veličinu cijelog polja, a za parametar polja veličinu pokazivača.', dEn: 'An operator that yields the size of a type or object in bytes (type `size_t`). For an array in the same function it gives the whole array\'s size; for an array parameter, the pointer\'s size.' },
        { hr: 'Složenost algoritma', en: 'Algorithm complexity', dHr: 'Kako vrijeme izvođenja (ili memorija) raste s veličinom ulaza n, npr. O(n), O(n log n), O(n²).', dEn: 'How running time (or memory) grows with the input size n, e.g. O(n), O(n log n), O(n²).' },
        { hr: 'Stabilno sortiranje', en: 'Stable sort', dHr: 'Sortiranje koje elementima s jednakim ključem čuva međusobni poredak. Stabilni su bubble sort, sortiranje umetanjem i merge sort; sortiranje izborom, quicksort i `qsort` nisu.', dEn: 'A sort that keeps the relative order of elements with equal keys. Bubble sort, insertion sort and merge sort are stable; selection sort, quicksort and `qsort` are not.' },
        { hr: 'Podijeli pa vladaj', en: 'Divide and conquer', dHr: 'Problem se podijeli na manje probleme istog oblika, oni se riješe (obično rekurzivno) i rješenja se spoje. Primjeri: merge sort, quicksort, binarno pretraživanje.', dEn: 'A problem is split into smaller problems of the same kind, those are solved (usually recursively) and the solutions are combined. Examples: merge sort, quicksort, binary search.' }
    ];

    EP.cheatsheet = { snippets, reference, glossary };
})();
