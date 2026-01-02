package com.gameservice.models

import com.gameservice.colorToRent
import kotlinx.serialization.Serializable
import java.util.UUID

@Serializable
class PropertyCollection {
    val collection : MutableMap<String, PropertySet> = mutableMapOf()
    private val propertyToSetId : MutableMap<Int, String> = mutableMapOf()
    private val developmentsToSetId : MutableMap<Int, String> = mutableMapOf()
    fun addProperty(property: Card.Property, withColor: Color?) : String? {
        if (withColor != null && !property.colors.contains(withColor)) return null
        if (withColor == null && property.colors != ALL_COLOR_SET) return null // Only rainbow wild can be placed with no color
        val result = collection.entries.find {
                (_, propertySet) -> propertySet.color == withColor && !propertySet.isComplete
        } ?: collection.entries.find { (_, propertySet) -> propertySet.color == null && !propertySet.isComplete }
        if (result == null) {
            val setId = UUID.randomUUID().toString().replace("-","")
            val newSet = PropertySet(
                setId,
                color = if (property.colors != ALL_COLOR_SET) withColor else null
            )
            collection.put(setId, newSet)
            newSet.addProperty(property, withColor)
            propertyToSetId[property.id] = setId
            return setId
        } else {
            result.value.addProperty(property, withColor)
            propertyToSetId[property.id] = result.key
            return result.key
        }
    }

    fun removeProperty(property: Card.Property) : Set<Card>? {
        val developmentsRemoved = mutableSetOf<Card>()
        val removedFrom: PropertySet? = propertyToSetId[property.id]?.let {
            val (wasRemoved, removedDevelopments) = collection[it]?.removeProperty(property) ?: return@let null
            if (removedDevelopments != null) developmentsRemoved.addAll(removedDevelopments)
            return@let if (wasRemoved) collection[it] else null
        }

        return removedFrom?.let {
            propertyToSetId.remove(property.id)
            if (it.isSetEmpty()) collection.remove(it.propertySetId)
            return@let developmentsRemoved
        }
    }

    fun isPropertyInCollection(property: Card.Property): Boolean {
        return propertyToSetId[property.id] != null
    }

    fun removeDevelopment(development: Card.Action) : Unit? {
        if (development.actionType !in arrayOf(ActionType.HOTEL, ActionType.HOTEL)) return null
        return developmentsToSetId[development.id]?.let { setId ->
            when (development.actionType) {
                ActionType.HOTEL -> collection[setId]?.hotel = null
                ActionType.HOUSE -> collection[setId]?.house = null
                else -> return null
            }
            developmentsToSetId.remove(development.id)
            if (collection[setId]?.isSetEmpty() == true) collection.remove(setId)
            return Unit
        }
    }

    fun addDevelopment(development: Card.Action, color: Color) : PropertySet? {
        val propertySet = collection.values.find { propertySet -> propertySet.color == color && propertySet.isComplete} ?: return null
        return propertySet.addDevelopment(development)?.let { propertySet }
    }

    fun addDevelopment(development: Card.Action, propertySetId: String) : Unit? {
        val propertySet = collection[propertySetId] ?: return null
        if (!propertySet.isComplete) return null
        return propertySet.addDevelopment(development)
    }

    fun isDevelopmentInCollection(development: Card.Action): Boolean {
        return developmentsToSetId[development.id] != null
    }

    fun getPropertySet(setId: String): PropertySet? {
        return collection[setId]
    }

    fun getSetOfDevelopment(developmentId: Int) : PropertySet? = developmentsToSetId[developmentId]?.let { collection[it] }

    fun getSetOfProperty(propertyId: Int) : PropertySet? = propertyToSetId[propertyId]?.let { collection[it] }

    fun totalValue() : Int {
        return collection.values.sumOf { it.totalValue() }
    }

    fun totalValueExcludingWildcards() : Int {
        return collection.values.sumOf { it.totalValueExcludingWildcards() }
    }

    fun getNumOfSellableCards() : Int {
        return collection.values.fold(0) { acc, propertySet -> acc + propertySet.getNumOfSellableCards() }
    }

    fun getNumOfSellableCardsExcludingWildcards() : Int {
        return collection.values.fold(0) { acc, propertySet -> acc + propertySet.getNumOfSellableCardsExcludingWildcards() }
    }

    fun removePropertySet(setId: String) : PropertySet? {
        val set = collection.remove(setId) ?: return null
        set.getCardIds().forEach(propertyToSetId::remove)
        set.getDevelopmentIds().forEach(developmentsToSetId::remove)
        return set
    }

    fun addPropertySet(set: PropertySet) {
        collection[set.propertySetId] = set
        set.getCardIds().forEach { propertyToSetId[it] = set.propertySetId }
        set.getDevelopmentIds().forEach { developmentsToSetId[it] = set.propertySetId }
    }

    fun numCompleteSets() : Int {
        return collection.values.fold(0) { acc, set ->
            acc + if (set.isComplete) 1 else 0
        }
    }
}

@Serializable
data class PropertySet(val propertySetId: String, val properties: MutableList<Card.Property> = mutableListOf(), var color: Color? = null, var house: Card.Action? = null, var hotel: Card.Action? = null, var isComplete: Boolean = false) {
    fun calculateRent() : Int {
        if (color == null) return 0
        if (!isComplete) return colorToRent[color]!![properties.size - 1]
        return colorToRent[color]!![properties.size - 1] + (house?.value ?: 0) + (hotel?.value ?: 0)
    }

    fun addProperty(property: Card.Property, withColor: Color?) {
        // Prevents single-color set invariant break
        if (withColor == null && property.colors != ALL_COLOR_SET) return
        if (withColor != null && !property.colors.contains(withColor)) return
        if (withColor != color && color != null) return
        if (isComplete) return // Prevents oversized set
        if (color == null) {
            color = if (property.colors == ALL_COLOR_SET) null else withColor // Rainbow Wild can't determine color
        }
        properties.add(property)
        if (isCompleteSet()) {
            isComplete = true
        }
    }

    fun removeProperty(property: Card.Property) : Pair<Boolean, Set<Card>?> {
        val wasRemoved = properties.removeIf { prop -> prop.id == property.id }
        val developmentsRemoved = mutableSetOf<Card>()
        if (wasRemoved) {
            if (properties.all { it.colors == ALL_COLOR_SET }) { // If all rainbow wilds, set color to null
                color = null
            }
            if (!isCompleteSet()) {
                isComplete = false
                house?.apply {
                    developmentsRemoved.add(house!!)
                    house = null
                }
                hotel?.apply {
                    developmentsRemoved.add(hotel!!)
                    hotel = null
                }
            }
        }
        return Pair(wasRemoved, developmentsRemoved)
    }

    fun totalValue(): Int {
        return properties.sumOf { prop -> prop.value ?: 0 } + (house?.value ?: 0) + (hotel?.value ?: 0)
    }

    fun totalValueExcludingWildcards(): Int {
        return properties.filter { it.colors != ALL_COLOR_SET }.sumOf { prop -> prop.value ?: 0 } + (house?.value ?: 0) + (hotel?.value ?: 0)
    }

    fun isSetEmpty(): Boolean {
        return (properties.isEmpty() && house == null && hotel == null)
    }

    fun getNumOfSellableCards(): Int {
        return properties.size + (if (house == null) 0 else 1) + (if (hotel == null) 0 else 1)
    }

    fun getNumOfSellableCardsExcludingWildcards(): Int {
        return properties.filter { it.colors != ALL_COLOR_SET }.size + (if (house == null) 0 else 1) + (if (hotel == null) 0 else 1)
    }

    private fun isCompleteSet() : Boolean {
        if (color == null) return false
        return properties.size == colorToRent[color]!!.size
    }

    fun addDevelopment(development: Card.Action) : Unit? {
        if (development.actionType !in arrayOf(ActionType.HOTEL, ActionType.HOTEL)) return null
        when (development.actionType) {
            ActionType.HOUSE -> {
                if (house != null) return null
                house = development
            }
            ActionType.HOTEL -> {
                if (house == null || hotel != null) return null
                hotel = development
            }
            else -> return null
        }
        return Unit
    }

    fun getCardIds() : List<Int> {
        return properties.map { it.id }
    }

    fun getDevelopmentIds() : List<Int> {
        val ids = mutableListOf<Int>()
        house?.let { ids.add(it.id) }
        hotel?.let { ids.add(it.id) }
        return ids
    }
}
