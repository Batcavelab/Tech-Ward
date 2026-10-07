from django.contrib import admin
from django.utils.html import format_html

from .models import Category, Product


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name_fr", "name_ar", "group", "order")
    list_editable = ("order",)
    prepopulated_fields = {"slug": ("name_fr",)}


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("thumb", "name_fr", "kind", "category", "brand", "price", "featured", "active", "order")
    list_display_links = ("thumb", "name_fr")
    list_editable = ("price", "featured", "active", "order")
    list_filter = ("kind", "category", "brand", "featured", "active")
    search_fields = ("name_fr", "name_ar", "brand")
    prepopulated_fields = {"slug": ("name_fr",)}
    fieldsets = (
        (None, {"fields": ("kind", "category", "brand", "slug", "price", "old_price",
                           "featured", "active", "order")}),
        ("Français", {"fields": ("name_fr", "short_fr", "specs_fr", "description_fr")}),
        ("العربية", {"fields": ("name_ar", "short_ar", "specs_ar", "description_ar")}),
        ("Image", {"fields": ("image", "art")}),
    )

    @admin.display(description="")
    def thumb(self, obj):
        if obj.image:
            return format_html('<img src="{}" style="height:40px;border-radius:6px">', obj.image.url)
        return "—"

