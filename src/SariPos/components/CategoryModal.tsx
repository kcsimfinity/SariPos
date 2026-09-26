import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { usePOS } from '../context/POSContext';
import { dbService } from '../database/databaseService';
import { Ionicons } from '@expo/vector-icons';
import { getTheme } from '../theme/theme';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const CategoryModal: React.FC<Props> = ({ visible, onClose }) => {
  const { categories, settings, refreshCategories } = usePOS();
  const theme = getTheme(settings.theme === 'dark');

  const [newCatName, setNewCatName] = useState('');

  const handleAdd = async () => {
    if (!newCatName.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name.');
      return;
    }

    try {
      await dbService.addCategory(newCatName.trim());
      setNewCatName('');
      await refreshCategories();
    } catch (e: any) {
      Alert.alert('Category Error', e.message || 'Failed to create category.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    Alert.alert('Delete Category', `Are you sure you want to delete "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await dbService.deleteCategory(id);
          await refreshCategories();
        }
      }
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.fullScreenContainer, { backgroundColor: theme.bg }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* 1. TOP NAVIGATION HEADER */}
          <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
            <TouchableOpacity style={styles.backBtn} onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={theme.textPrimary} />
            </TouchableOpacity>

            <View style={styles.headerTitleGroup}>
              <Text style={[styles.title, { color: theme.textPrimary }]}>
                Manage Custom Categories
              </Text>
              <Text style={[styles.sub, { color: theme.textSecondary }]}>
                Create and organize store product categories.
              </Text>
            </View>

            <TouchableOpacity style={[styles.doneHeaderBtn, { backgroundColor: theme.primary }]} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="checkmark-circle" size={16} color="#ffffff" />
              <Text style={styles.doneHeaderBtnText}>Done</Text>
            </TouchableOpacity>
          </View>

          {/* 2. BODY CONTENT */}
          <View style={styles.body}>
            {/* CREATE CATEGORY SECTION */}
            <View style={styles.sectionBox}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
                CREATE NEW CATEGORY
              </Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.bigInput, { backgroundColor: theme.surface, color: theme.textPrimary, borderColor: theme.border }]}
                  placeholder="Type category name (e.g., Beverages, Snacks)..."
                  placeholderTextColor={theme.textMuted}
                  value={newCatName}
                  onChangeText={setNewCatName}
                />

                <TouchableOpacity
                  style={[styles.addBtn, { backgroundColor: theme.primary }]}
                  onPress={handleAdd}
                  activeOpacity={0.8}
                >
                  <Ionicons name="add-circle" size={18} color="#ffffff" />
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SCROLLABLE CATEGORIES LIST */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.stepLabel, { color: theme.textSecondary, marginBottom: 8 }]}>
                EXISTING CATEGORIES ({categories.length})
              </Text>

              {categories.length === 0 ? (
                <View style={[styles.emptyBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <Ionicons name="folder-open-outline" size={32} color={theme.textMuted} />
                  <Text style={[styles.emptyText, { color: theme.textPrimary }]}>
                    No categories created yet.
                  </Text>
                </View>
              ) : (
                <FlatList
                  data={categories}
                  keyExtractor={item => item.id}
                  numColumns={2}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 16 }}
                  renderItem={({ item }) => (
                    <View style={[styles.catCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <View style={styles.catCardLeft}>
                        <View style={[styles.tagIconBadge, { backgroundColor: theme.surfaceElevated }]}>
                          <Ionicons name="pricetag" size={14} color={theme.accent} />
                        </View>
                        <Text style={[styles.catName, { color: theme.textPrimary }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                      </View>

                      <TouchableOpacity
                        onPress={() => handleDelete(item.id, item.name)}
                        style={styles.deleteBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="trash-outline" size={16} color={theme.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                />
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  fullScreenContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  headerTitleGroup: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  doneHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  doneHeaderBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  body: {
    flex: 1,
    padding: 16,
    gap: 16,
  },
  sectionBox: {
    gap: 8,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  bigInput: {
    flex: 1,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 14,
    fontWeight: 'bold',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    height: 50,
    borderRadius: 10,
    justifyContent: 'center',
  },
  addBtnText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  catCard: {
    flex: 1 / 2,
    margin: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 50,
    borderRadius: 10,
    borderWidth: 1,
  },
  catCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 6,
  },
  tagIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catName: {
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  deleteBtn: {
    padding: 6,
  },
  emptyBox: {
    padding: 30,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});