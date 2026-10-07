from django.contrib import admin

from .models import (Article, Customer, Expense, Offer, OfferItem, PurchaseLine, PurchaseOrder, Quote,
                     QuoteLine, StockMovement, Supplier)

# The day-to-day screens are in /gestion/; these admin pages are a fallback.
admin.site.register([Customer, Supplier, Article, Expense, StockMovement])


class OfferItemInline(admin.TabularInline):
    model = OfferItem


@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    inlines = [OfferItemInline]


class QuoteLineInline(admin.TabularInline):
    model = QuoteLine


@admin.register(Quote)
class QuoteAdmin(admin.ModelAdmin):
    list_display = ("number", "customer", "date", "status")
    inlines = [QuoteLineInline]


class PurchaseLineInline(admin.TabularInline):
    model = PurchaseLine


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("number", "supplier", "date", "status")
    inlines = [PurchaseLineInline]
