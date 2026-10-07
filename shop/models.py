from django.db import models
from django.urls import reverse
from django.utils.translation import get_language


class Bilingual:
    """Pick the French or Arabic version of a field for the active language."""

    def tr(self, field):
        lang = (get_language() or "fr")[:2]
        value = getattr(self, f"{field}_{lang}", "")
        return value or getattr(self, f"{field}_fr", "")


class Category(Bilingual, models.Model):
    GROUPS = [
        ("cameras", "Caméras"),
        ("recording", "Enregistrement"),
        ("alarm", "Alarme"),
        ("access", "Contrôle d'accès"),
        ("accessories", "Accessoires"),
    ]
    slug = models.SlugField(unique=True)
    group = models.CharField(max_length=20, choices=GROUPS, default="cameras")
    name_fr = models.CharField("Nom (FR)", max_length=80)
    name_ar = models.CharField("Nom (AR)", max_length=80, blank=True)
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["order", "name_fr"]
        verbose_name = "catégorie"

    def __str__(self):
        return self.name_fr


class Product(Bilingual, models.Model):
    KIND_PRODUCT, KIND_PACK, KIND_SERVICE = "product", "pack", "service"
    KINDS = [
        (KIND_PRODUCT, "Produit"),
        (KIND_PACK, "Pack d'installation"),
        (KIND_SERVICE, "Service (alarme, accès...)"),
    ]
    # Drawing used when no photo is uploaded yet.
    ART = [
        ("indoor", "Caméra intérieure"), ("bullet", "Caméra extérieure"),
        ("ptz", "Caméra PTZ / dôme"), ("doorbell", "Sonnette vidéo"),
        ("nvr", "Enregistreur"), ("hdd", "Disque dur"),
        ("alarm", "Centrale d'alarme"), ("sensor", "Détecteur"),
        ("siren", "Sirène"), ("keypad", "Lecteur badge / clavier"),
        ("finger", "Empreinte digitale"), ("intercom", "Interphone vidéo"),
        ("lock", "Serrure connectée"), ("cable", "Câble / accessoire"),
        ("pack", "Pack caméras"), ("service", "Service / technicien"),
    ]

    kind = models.CharField("Type", max_length=10, choices=KINDS, default=KIND_PRODUCT)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True,
                                 related_name="products", verbose_name="Catégorie")
    slug = models.SlugField(unique=True)
    brand = models.CharField("Marque", max_length=40, blank=True)
    name_fr = models.CharField("Nom (FR)", max_length=120)
    name_ar = models.CharField("Nom (AR)", max_length=120, blank=True)
    short_fr = models.CharField("Accroche (FR)", max_length=160, blank=True)
    short_ar = models.CharField("Accroche (AR)", max_length=160, blank=True)
    description_fr = models.TextField("Description (FR)", blank=True)
    description_ar = models.TextField("Description (AR)", blank=True)
    specs_fr = models.TextField("Caractéristiques (FR)", blank=True, help_text="Une par ligne.")
    specs_ar = models.TextField("Caractéristiques (AR)", blank=True, help_text="Une par ligne.")
    price = models.DecimalField("Prix (MAD)", max_digits=10, decimal_places=0, null=True, blank=True,
                                help_text="Vide = sur devis. 0 = gratuit.")
    old_price = models.DecimalField("Ancien prix (MAD)", max_digits=10, decimal_places=0,
                                    null=True, blank=True)
    image = models.ImageField("Photo", upload_to="products/", blank=True)
    art = models.CharField("Dessin par défaut", max_length=10, choices=ART, default="bullet")
    featured = models.BooleanField("Mis en avant (accueil)", default=False)
    active = models.BooleanField("Visible", default=True)
    order = models.PositiveSmallIntegerField("Ordre", default=0)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "produit / pack / service"
        verbose_name_plural = "produits, packs et services"

    def __str__(self):
        return self.name_fr

    def get_absolute_url(self):
        return reverse("shop:product", args=[self.slug])

    # Photos cut from the design mockup, shown until a real photo is uploaded.
    MOCKUP_PHOTOS = {"indoor": "indoor", "bullet": "outdoor", "ptz": "ptz", "doorbell": "doorbell"}

    SERVICE_PHOTOS = {"installation-alarme", "installation-controle-acces", "contrat-maintenance", "visite-technique"}

    def mockup_photo(self):
        name = self.slug if self.slug in self.SERVICE_PHOTOS else self.MOCKUP_PHOTOS.get(self.art)
        return f"img/photos/{name}.jpg" if name else ""

    @property
    def on_quote(self):
        return self.price is None

    def spec_list(self):
        return [line.strip() for line in self.tr("specs").splitlines() if line.strip()]

