from django import forms
from django.forms import inlineformset_factory
from django.utils.text import slugify

from shop.models import Product

from .models import (Article, Customer, Expense, Offer, OfferItem, PackItem, PurchaseLine, PurchaseOrder,
                     Quote, QuoteLine, SiteSettings, StockMovement, Supplier)

DATE = forms.DateInput(attrs={"type": "date"}, format="%Y-%m-%d")


class ProductForm(forms.ModelForm):
    class Meta:
        model = Product
        fields = ["name_fr", "name_ar", "category", "brand", "price", "old_price", "short_fr", "short_ar",
                  "specs_fr", "specs_ar", "description_fr", "description_ar", "image", "art",
                  "featured", "active", "order", "slug"]
        widgets = {f: forms.Textarea(attrs={"rows": 4}) for f in
                   ["specs_fr", "specs_ar", "description_fr", "description_ar"]}
        widgets.update({f: forms.TextInput(attrs={"dir": "rtl"}) for f in ["name_ar", "short_ar"]})
        for f in ["specs_ar", "description_ar"]:
            widgets[f] = forms.Textarea(attrs={"rows": 4, "dir": "rtl"})

    def __init__(self, *args, kind=Product.KIND_PRODUCT, **kwargs):
        super().__init__(*args, **kwargs)
        self.kind = kind
        self.fields["slug"].required = False
        self.fields["slug"].help_text = "Adresse de la page sur le site. Laisser vide pour la créer depuis le nom."
        self.fields["price"].help_text = "Vide = « Sur devis » sur le site. 0 = gratuit."
        self.fields["old_price"].help_text = "Affiché barré sur le site (géré automatiquement par les offres)."
        if kind == Product.KIND_PACK:
            for f in ["category", "brand", "art"]:
                self.fields.pop(f)

    def clean_slug(self):
        slug = self.cleaned_data.get("slug") or slugify(self.cleaned_data.get("name_fr", ""))[:50] or "article"
        base, n = slug, 2
        while Product.objects.filter(slug=slug).exclude(pk=self.instance.pk).exists():
            slug, n = f"{base}-{n}", n + 1
        return slug

    def save(self, commit=True):
        self.instance.kind = self.instance.kind if self.instance.pk else self.kind
        if self.kind == Product.KIND_PACK:
            self.instance.art = "pack"
        return super().save(commit)


class ArticleForm(forms.ModelForm):
    class Meta:
        model = Article
        fields = ["cost_price", "sku", "supplier", "min_stock", "location"]


class PackItemForm(forms.ModelForm):
    class Meta:
        model = PackItem
        fields = ["component", "quantity"]


PackItemFormSet = inlineformset_factory(Product, PackItem, form=PackItemForm, fk_name="pack",
                                        extra=3, can_delete=True)


class OfferForm(forms.ModelForm):
    class Meta:
        model = Offer
        fields = ["name", "description", "start_date", "end_date", "active"]
        widgets = {"start_date": DATE, "end_date": DATE}

    def clean(self):
        data = super().clean()
        if data.get("end_date") and data.get("start_date") and data["end_date"] < data["start_date"]:
            self.add_error("end_date", "La fin doit être après le début.")
        return data


OfferItemFormSet = inlineformset_factory(Offer, OfferItem, fields=["product", "offer_price"], extra=3, can_delete=True)


class CustomerForm(forms.ModelForm):
    class Meta:
        model = Customer
        exclude = ["created_at"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 3})}


class SupplierForm(forms.ModelForm):
    class Meta:
        model = Supplier
        exclude = ["created_at"]
        widgets = {"notes": forms.Textarea(attrs={"rows": 3})}


class QuoteForm(forms.ModelForm):
    class Meta:
        model = Quote
        fields = ["customer", "date", "valid_until", "discount", "tva_rate", "notes"]
        widgets = {"date": DATE, "valid_until": DATE, "notes": forms.Textarea(attrs={"rows": 3})}


class QuoteLineForm(forms.ModelForm):
    class Meta:
        model = QuoteLine
        fields = ["product", "description", "quantity", "unit_price"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["product"].queryset = Product.objects.order_by("kind", "name_fr")
        self.fields["description"].help_text = ""
        self.fields["unit_price"].help_text = ""

    def clean(self):
        data = super().clean()
        if not data.get("product") and not data.get("description") and not data.get("DELETE"):
            if self.has_changed():
                raise forms.ValidationError("Choisissez un produit ou écrivez une désignation.")
        return data


QuoteLineFormSet = inlineformset_factory(Quote, QuoteLine, form=QuoteLineForm, extra=4, can_delete=True)


class PurchaseOrderForm(forms.ModelForm):
    class Meta:
        model = PurchaseOrder
        fields = ["supplier", "date", "expected_date", "notes"]
        widgets = {"date": DATE, "expected_date": DATE, "notes": forms.Textarea(attrs={"rows": 3})}


class PurchaseLineForm(forms.ModelForm):
    class Meta:
        model = PurchaseLine
        fields = ["product", "quantity", "unit_cost"]


PurchaseLineFormSet = inlineformset_factory(PurchaseOrder, PurchaseLine, form=PurchaseLineForm,
                                            extra=4, can_delete=True)


class ExpenseForm(forms.ModelForm):
    class Meta:
        model = Expense
        fields = ["date", "category", "label", "amount", "supplier"]
        widgets = {"date": DATE}


class StockAdjustForm(forms.Form):
    MODES = [("entree", "Entrée (+)"), ("sortie", "Sortie (−)"), ("ajustement", "Inventaire : stock réel compté")]
    product = forms.ModelChoiceField(Product.objects.filter(kind=Product.KIND_PRODUCT).order_by("name_fr"),
                                     label="Produit")
    mode = forms.ChoiceField(choices=MODES, label="Type")
    quantity = forms.IntegerField(min_value=0, label="Quantité")
    reason = forms.CharField(max_length=160, required=False, label="Motif")

    def save(self):
        product, mode, qty = (self.cleaned_data[k] for k in ("product", "mode", "quantity"))
        if mode == "ajustement":
            from .models import article_for
            qty = qty - article_for(product).stock
        elif mode == "sortie":
            qty = -qty
        if qty:
            StockMovement.objects.create(product=product, kind=mode, quantity=qty,
                                         reason=self.cleaned_data["reason"] or dict(self.MODES)[mode])
        return qty


class SiteSettingsForm(forms.ModelForm):
    class Meta:
        model = SiteSettings
        exclude = ["updated_at"]
        widgets = {
            "hero_title_fr": forms.Textarea(attrs={"rows": 2}),
            "hero_text_fr": forms.Textarea(attrs={"rows": 3}),
            "hero_title_ar": forms.Textarea(attrs={"rows": 2, "dir": "rtl"}),
            "hero_text_ar": forms.Textarea(attrs={"rows": 3, "dir": "rtl"}),
            "hero_image": forms.FileInput(attrs={"accept": "image/*"}),
        }

    reset_hero = forms.BooleanField(label="Remettre la photo d'origine", required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from shop.i18n import t

        from .site import DEFAULTS
        placeholders = {key: DEFAULTS[key] for key in ("phone_display", "whatsapp", "email", "address")}
        for lang in ("fr", "ar"):
            placeholders[f"hero_title_{lang}"] = f"{t('hero_title_1', lang)}\n{t('hero_title_2', lang)}"
            placeholders[f"hero_text_{lang}"] = t("hero_text", lang)
        for name, text in placeholders.items():
            if text:
                self.fields[name].widget.attrs["placeholder"] = text

    def clean_whatsapp(self):
        number = "".join(c for c in self.cleaned_data["whatsapp"] if c.isdigit())
        if number.startswith("00"):
            number = number[2:]
        if number.startswith("0") and len(number) == 10:  # 06xxxxxxxx -> 2126xxxxxxxx
            number = "212" + number[1:]
        if number and not 10 <= len(number) <= 15:
            raise forms.ValidationError("Numéro invalide. Exemple : 212675474294.")
        return number

    def clean_hero_image(self):
        image = self.cleaned_data.get("hero_image")
        if image and getattr(image, "size", 0) > 5 * 1024 * 1024:
            raise forms.ValidationError("Image trop lourde (5 Mo maximum).")
        return image

    def save(self, commit=True):
        site = super().save(commit=False)
        if self.cleaned_data.get("reset_hero") and "hero_image" not in self.changed_data:
            site.hero_image.delete(save=False)
            site.hero_image = ""
        if commit:
            site.save()
        return site
