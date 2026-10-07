"""Back office of Tech-Ward: customers, suppliers, stock, devis, purchase orders, costs.

The catalog itself (products, packs, services, prices) is shop.Product, the same
table the public site is built from, so a price changed here is on the site after
the next build.
"""
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import F
from django.utils import timezone

from shop.models import Product

ZERO = Decimal("0")


def next_number(model, prefix):
    """DV-2026-0001, DV-2026-0002... restarting every year."""
    year = timezone.localdate().year
    start = f"{prefix}-{year}-"
    last = (model.objects.filter(number__startswith=start).order_by("-number")
            .values_list("number", flat=True).first())
    n = int(last.rsplit("-", 1)[1]) + 1 if last else 1
    return f"{start}{n:04d}"


class Customer(models.Model):
    KINDS = [("particulier", "Particulier"), ("entreprise", "Entreprise")]
    name = models.CharField("Nom / raison sociale", max_length=120)
    kind = models.CharField("Type", max_length=12, choices=KINDS, default="particulier")
    phone = models.CharField("Téléphone / WhatsApp", max_length=30, blank=True)
    email = models.EmailField("Email", blank=True)
    city = models.CharField("Ville", max_length=60, blank=True)
    address = models.CharField("Adresse", max_length=200, blank=True)
    ice = models.CharField("ICE", max_length=30, blank=True)
    notes = models.TextField("Notes", blank=True)
    created_at = models.DateTimeField("Créé le", auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "client"

    def __str__(self):
        return self.name


class Supplier(models.Model):
    name = models.CharField("Nom / raison sociale", max_length=120)
    contact_name = models.CharField("Contact", max_length=80, blank=True)
    phone = models.CharField("Téléphone / WhatsApp", max_length=30, blank=True)
    email = models.EmailField("Email", blank=True)
    city = models.CharField("Ville", max_length=60, blank=True)
    address = models.CharField("Adresse", max_length=200, blank=True)
    ice = models.CharField("ICE", max_length=30, blank=True)
    brands = models.CharField("Marques", max_length=120, blank=True, help_text="Ex. Hikvision, Dahua")
    notes = models.TextField("Notes", blank=True)
    created_at = models.DateTimeField("Créé le", auto_now_add=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "fournisseur"

    def __str__(self):
        return self.name


class Article(models.Model):
    """Buying and stock details of a catalog item (kept out of the public site)."""
    product = models.OneToOneField(Product, on_delete=models.CASCADE, related_name="article")
    sku = models.CharField("Référence", max_length=40, blank=True)
    cost_price = models.DecimalField("Prix d'achat (MAD)", max_digits=10, decimal_places=2, default=0,
                                     help_text="Pour un pack ou un service : coût de main d'œuvre et divers.")
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="articles", verbose_name="Fournisseur habituel")
    stock = models.IntegerField("Stock", default=0, editable=False)
    min_stock = models.PositiveIntegerField("Seuil d'alerte", default=2)
    location = models.CharField("Emplacement", max_length=60, blank=True, help_text="Ex. Étagère A2")

    class Meta:
        verbose_name = "fiche article"

    def __str__(self):
        return str(self.product)

    @property
    def low(self):
        return self.product.kind == Product.KIND_PRODUCT and self.stock <= self.min_stock


def article_for(product):
    article, _ = Article.objects.get_or_create(product=product)
    return article


def unit_cost(product):
    """Cost of one unit: buying price, or for a pack its parts plus labour."""
    own = article_for(product).cost_price
    if product.kind == Product.KIND_PACK:
        for item in product.pack_items.select_related("component"):
            own += item.quantity * article_for(item.component).cost_price
    return own


class PackItem(models.Model):
    pack = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="pack_items",
                             limit_choices_to={"kind": Product.KIND_PACK})
    component = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="in_packs",
                                  limit_choices_to={"kind": Product.KIND_PRODUCT}, verbose_name="Produit")
    quantity = models.PositiveIntegerField("Quantité", default=1)

    class Meta:
        verbose_name = "contenu de pack"


class Offer(models.Model):
    """A promotion: while it runs, the site shows the old price struck through."""
    name = models.CharField("Nom de l'offre", max_length=120)
    description = models.CharField("Description", max_length=250, blank=True)
    start_date = models.DateField("Début", default=timezone.localdate)
    end_date = models.DateField("Fin", null=True, blank=True, help_text="Vide = sans date de fin.")
    active = models.BooleanField("Active", default=True)

    class Meta:
        ordering = ["-start_date"]
        verbose_name = "offre"

    def __str__(self):
        return self.name

    def is_running(self, today=None):
        today = today or timezone.localdate()
        return self.active and self.start_date <= today and (self.end_date is None or today <= self.end_date)


class OfferItem(models.Model):
    offer = models.ForeignKey(Offer, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="offer_items",
                                verbose_name="Produit / pack")
    offer_price = models.DecimalField("Prix promo (MAD)", max_digits=10, decimal_places=0)
    original_price = models.DecimalField(max_digits=10, decimal_places=0, null=True, blank=True, editable=False)
    applied = models.BooleanField(default=False, editable=False)


class Quote(models.Model):
    DRAFT, SENT, ACCEPTED, DONE, REFUSED = "brouillon", "envoye", "accepte", "realise", "refuse"
    STATUSES = [
        (DRAFT, "Brouillon"), (SENT, "Envoyé"), (ACCEPTED, "Accepté"),
        (DONE, "Réalisé et payé"), (REFUSED, "Refusé"),
    ]
    number = models.CharField("N°", max_length=20, unique=True, editable=False)
    customer = models.ForeignKey(Customer, on_delete=models.PROTECT, related_name="quotes", verbose_name="Client")
    date = models.DateField("Date", default=timezone.localdate)
    valid_until = models.DateField("Valable jusqu'au", null=True, blank=True)
    status = models.CharField("Statut", max_length=10, choices=STATUSES, default=DRAFT)
    discount = models.DecimalField("Remise (MAD)", max_digits=10, decimal_places=2, default=0)
    tva_rate = models.DecimalField("TVA (%)", max_digits=4, decimal_places=1,
                                   default=Decimal(str(settings.TECHWARD.get("tva", 0))))
    notes = models.TextField("Notes pour le client", blank=True)
    done_date = models.DateField("Date de réalisation", null=True, blank=True)
    stock_done = models.BooleanField(default=False, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-number"]
        verbose_name = "devis"
        verbose_name_plural = "devis"

    def __str__(self):
        return self.number

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_number(Quote, "DV")
        if not self.valid_until:
            self.valid_until = self.date + timedelta(days=15)
        super().save(*args, **kwargs)

    @property
    def subtotal(self):
        return sum((line.total for line in self.lines.all()), ZERO)

    @property
    def total_ht(self):
        return self.subtotal - self.discount

    @property
    def tva(self):
        return (self.total_ht * self.tva_rate / 100).quantize(Decimal("0.01"))

    @property
    def total_ttc(self):
        return self.total_ht + self.tva

    @property
    def cost(self):
        return sum((line.quantity * line.unit_cost for line in self.lines.all()), ZERO)

    @property
    def margin(self):
        return self.total_ht - self.cost


class QuoteLine(models.Model):
    quote = models.ForeignKey(Quote, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True, blank=True,
                                related_name="quote_lines", verbose_name="Produit / pack / service")
    description = models.CharField("Désignation", max_length=200, blank=True)
    quantity = models.PositiveIntegerField("Qté", default=1)
    unit_price = models.DecimalField("Prix unitaire (MAD)", max_digits=10, decimal_places=2, null=True, blank=True)
    unit_cost = models.DecimalField("Coût unitaire", max_digits=10, decimal_places=2, default=0, editable=False)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        if self.product:
            if not self.description:
                self.description = self.product.name_fr
            if self.unit_price is None:
                self.unit_price = self.product.price or 0
            if not self.unit_cost:
                self.unit_cost = unit_cost(self.product)
        if self.unit_price is None:
            self.unit_price = 0
        super().save(*args, **kwargs)

    @property
    def total(self):
        return self.quantity * (self.unit_price or 0)


class PurchaseOrder(models.Model):
    DRAFT, SENT, RECEIVED, CANCELLED = "brouillon", "envoye", "recu", "annule"
    STATUSES = [(DRAFT, "Brouillon"), (SENT, "Envoyé"), (RECEIVED, "Reçu"), (CANCELLED, "Annulé")]
    number = models.CharField("N°", max_length=20, unique=True, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name="orders", verbose_name="Fournisseur")
    date = models.DateField("Date", default=timezone.localdate)
    expected_date = models.DateField("Livraison souhaitée", null=True, blank=True)
    status = models.CharField("Statut", max_length=10, choices=STATUSES, default=DRAFT)
    notes = models.TextField("Notes pour le fournisseur", blank=True)
    received_date = models.DateField("Reçu le", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-number"]
        verbose_name = "bon de commande"
        verbose_name_plural = "bons de commande"

    def __str__(self):
        return self.number

    def save(self, *args, **kwargs):
        if not self.number:
            self.number = next_number(PurchaseOrder, "BC")
        super().save(*args, **kwargs)

    @property
    def total(self):
        return sum((line.total for line in self.lines.all()), ZERO)


class PurchaseLine(models.Model):
    order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="purchase_lines",
                                limit_choices_to={"kind": Product.KIND_PRODUCT}, verbose_name="Produit")
    quantity = models.PositiveIntegerField("Qté", default=1)
    unit_cost = models.DecimalField("Prix d'achat unitaire (MAD)", max_digits=10, decimal_places=2, null=True, blank=True)

    class Meta:
        ordering = ["id"]

    def save(self, *args, **kwargs):
        if self.unit_cost is None:
            self.unit_cost = article_for(self.product).cost_price
        super().save(*args, **kwargs)

    @property
    def total(self):
        return self.quantity * (self.unit_cost or 0)


class Expense(models.Model):
    PURCHASES = "achats"
    CATEGORIES = [
        (PURCHASES, "Achats de marchandises"), ("transport", "Transport et carburant"),
        ("main_oeuvre", "Main d'œuvre / sous-traitance"), ("outillage", "Outillage et consommables"),
        ("marketing", "Marketing et publicité"), ("loyer", "Loyer et charges"),
        ("telecom", "Téléphone et internet"), ("impots", "Impôts et taxes"), ("autre", "Autre"),
    ]
    date = models.DateField("Date", default=timezone.localdate)
    category = models.CharField("Catégorie", max_length=12, choices=CATEGORIES, default="autre")
    label = models.CharField("Libellé", max_length=160)
    amount = models.DecimalField("Montant (MAD)", max_digits=10, decimal_places=2)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="expenses", verbose_name="Fournisseur")
    purchase_order = models.OneToOneField(PurchaseOrder, on_delete=models.CASCADE, null=True, blank=True,
                                          related_name="expense", editable=False)

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "dépense"

    def __str__(self):
        return self.label


class StockMovement(models.Model):
    KINDS = [("entree", "Entrée"), ("sortie", "Sortie"), ("ajustement", "Ajustement / inventaire")]
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name="stock_movements",
                                verbose_name="Produit")
    date = models.DateTimeField("Date", default=timezone.now)
    kind = models.CharField("Type", max_length=10, choices=KINDS)
    quantity = models.IntegerField("Quantité", help_text="Positif = entrée, négatif = sortie.")
    reason = models.CharField("Motif", max_length=160, blank=True)
    quote = models.ForeignKey(Quote, on_delete=models.SET_NULL, null=True, blank=True, related_name="movements")
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True,
                                       related_name="movements")

    class Meta:
        ordering = ["-date", "-id"]
        verbose_name = "mouvement de stock"

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        super().save(*args, **kwargs)
        if is_new:
            article_for(self.product)
            Article.objects.filter(product=self.product).update(stock=F("stock") + self.quantity)


class SiteSettings(models.Model):
    """Website basics edited in Gestion → Site web. A single row (pk=1); empty fields keep the defaults."""
    phone_display = models.CharField("Téléphone affiché", max_length=40, blank=True,
                                     help_text="Tel qu'il apparaît sur le site, ex. 06 75 47 42 94.")
    whatsapp = models.CharField("Numéro WhatsApp", max_length=20, blank=True,
                                help_text="Format international sans + ni espaces, ex. 212675474294. "
                                          "Reçoit les commandes et les questions.")
    email = models.EmailField("Email", blank=True)
    address = models.CharField("Adresse", max_length=200, blank=True,
                               help_text="Affichée sur la page Contact, en bas du site et sur les devis.")
    hero_image = models.ImageField("Image de la bannière", upload_to="site/", blank=True,
                                   help_text="Photo large, idéalement 1600 × 700 px. Vide = photo actuelle.")
    hero_title_fr = models.TextField("Titre de la bannière (français)", blank=True,
                                     help_text="Vide = titre actuel. Un retour à la ligne coupe le titre.")
    hero_text_fr = models.TextField("Texte de la bannière (français)", blank=True)
    hero_title_ar = models.TextField("Titre de la bannière (arabe)", blank=True)
    hero_text_ar = models.TextField("Texte de la bannière (arabe)", blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "réglages du site"

    def __str__(self):
        return "Réglages du site"

    @classmethod
    def load(cls):
        return cls.objects.get_or_create(pk=1)[0]
