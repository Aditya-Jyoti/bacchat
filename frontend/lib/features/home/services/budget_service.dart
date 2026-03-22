import '../models/budget_data.dart';
import '../models/user_data.dart';

class BudgetService {
  /// Fetch budget data from API
  /// Falls back to default data if API is unavailable
   
  /// TODO: Implement actual API call when backend is ready
  /// Expected API response:
  /// {
  ///   "moneySpent": 10000.0,
  ///   "monthlyBudget": 15000.0
  /// }
  static Future<BudgetData> fetchBudgetData() async {
    // Replace this with actual API call:
    /*
    try {
      final response = await http.get(
        Uri.parse('https://your-api-endpoint.com/api/budget'),
      );
      if (response.statusCode == 200) {
        return BudgetData.fromJson(json.decode(response.body));
      }
    } catch (e) {
      print('Budget API error: $e');
    }
    */
    
    return BudgetData.defaultData();
  }

  /// Fetch user data from API
  /// Falls back to default data (Guest) if API is unavailable
  /// 
  /// TODO: Implement actual API call when backend is ready
  /// Expected API response:
  /// {
  ///   "userName": "Aditya",
  ///   "avatarUrl": "https://...",
  ///   "isLoggedIn": true
  /// }
  static Future<UserData> fetchUserData() async {
    // Replace this with actual API call:
    /*
    try {
      final response = await http.get(
        Uri.parse('https://your-api-endpoint.com/api/user'),
      );
      if (response.statusCode == 200) {
        return UserData.fromJson(json.decode(response.body));
      }
    } catch (e) {
      print('User API error: $e');
    }
    */
    
    return UserData.defaultData();
  }
}